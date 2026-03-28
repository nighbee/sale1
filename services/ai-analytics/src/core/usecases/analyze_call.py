import logging
import os
import json
from src.adapters.storage.postgres_repo import (
    get_transcript, get_call, get_active_script_by_manager, get_team_script, save_analysis,
    create_notification, get_admin_user, update_call_status
)
from src.adapters.llm.factory import LLMProviderFactory
from src.infrastructure.prompts.system_prompts import SYSTEM_PROMPT, get_user_prompt
from src.adapters.events.redis_publisher import publish_analysis_completed, publish_critical_error
from src.adapters.crm.amocrm_client import AmoCRMClient
from src.infrastructure.api.main_api_client import MainAPIClient

logger = logging.getLogger(__name__)

class AnalyzeCallUseCase:
    def __init__(self):
        self.crm_client = AmoCRMClient()
        self.api_client = MainAPIClient()

    async def execute(self, call_id: str):
        logger.info("analyzing call", extra={"call_id": call_id})

        # 1. Fetch data
        transcript = get_transcript(call_id)
        if not transcript:
            logger.error("transcript not found", extra={"call_id": call_id})
            return

        call = get_call(call_id)
        if not call:
            logger.error("call record not found", extra={"call_id": call_id})
            return

        manager_id = call['manager_id']

        # 2. Get script - try team script first, then global active script
        script = get_team_script(manager_id)
        if not script:
            script = get_active_script_by_manager(manager_id)
        
        script_text = script['parsed_text'] if script else "No active script found."
        script_id = script['id'] if script else None

        # 3. Prepare prompt
        transcript_text = self._format_transcript(transcript['speaker_diarized_json'])
        transcript_segments = transcript['speaker_diarized_json'] or []

        if not transcript_text.strip():
            logger.warning(
                "transcript is empty, skipping analysis",
                extra={"call_id": call_id, "manager_id": manager_id}
            )
            update_call_status(call_id, 'error')
            from src.adapters.storage.postgres_repo import log_processing_event
            log_processing_event(call_id, "ai-analytics", "error", error_message="Empty transcript")
            return

        user_prompt = get_user_prompt(transcript_text, script_text)

        logger.info(
            "[1/4] data fetched",
            extra={
                "call_id": call_id,
                "transcript_segment_count": len(transcript_segments),
                "transcript_text_length": len(transcript_text),
                "script_id": script_id,
                "script_found": script is not None,
                "call_duration_s": call.get('duration'),
                "manager_id": manager_id,
            },
        )

        # 4. Get LLM settings
        ai_settings = await self.api_client.get_ai_settings()

        # Priority: 1. integrations (DB) 2. fallback to .env
        llm_provider_name = None
        llm_model_name = None

        if ai_settings:
            llm_provider_name = ai_settings.get("llm_provider")
            llm_model_name = ai_settings.get("llm_model")

        # Fallback to .env
        llm_provider_name = llm_provider_name or os.getenv("LLM_PROVIDER")
        llm_model_name = llm_model_name or os.getenv("LLM_MODEL")

        # Final default
        llm_provider_name = llm_provider_name or "openai"

        integrations = await self.api_client.get_active_integrations()

        logger.info(
            "[2/4] sending to LLM",
            extra={
                "call_id": call_id,
                "llm_provider": llm_provider_name,
                "llm_model": llm_model_name,
                "prompt_chars": len(SYSTEM_PROMPT) + len(user_prompt),
            },
        )

        llm_provider = LLMProviderFactory.create(llm_provider_name, integrations, default_model=llm_model_name)
        analysis = await llm_provider.analyze(SYSTEM_PROMPT, user_prompt)

        logger.info(
            "[2/4] LLM response received",
            extra={
                "call_id": call_id,
                "llm_provider": llm_provider,
                "response_fields": list(analysis.keys()),
                "qualityOfCall": analysis.get("qualityOfCall"),
                "scriptMatch": analysis.get("scriptMatch"),
                "errorsFree": analysis.get("errorsFree"),
                "brief_preview": analysis.get("brief", "")[:100],
            },
        )

        # 3.5 Validate LLM response
        self._validate_llm_response(analysis, call_id)

        # 4. Calculate KPI
        quality = analysis['qualityOfCall']
        script_match = analysis['scriptMatch']
        errors_free = analysis['errorsFree']
        duration = call['duration']

        overall_rating = quality * 0.4 + script_match * 0.4 + errors_free * 0.2
        kpi = overall_rating * (duration / 60.0)

        logger.info(
            "[3/4] KPI calculated",
            extra={
                "call_id": call_id,
                "quality": quality,
                "script_match": script_match,
                "errors_free": errors_free,
                "duration_s": duration,
                "overall_rating": round(overall_rating, 2),
                "kpi": round(kpi, 2),
            },
        )

        # 5. Save report
        report = {
            'call_id': call_id,
            'script_id': script_id,
            'quality_score': quality,
            'script_match': script_match,
            'errors_free': errors_free,
            'overall_rating': overall_rating,
            'kpi': round(kpi, 2),
            'recommendation': analysis.get('recommendation', ''),
            'brief': analysis.get('brief', ''),
            'next_best_action': analysis.get('nextBestAction', ''),
            'llm_provider': llm_provider_name
        }

        save_analysis(report)
        update_call_status(call_id, 'completed')
        logger.info(
            "[4/4] analysis saved to DB",
            extra={
                "call_id": call_id,
                "llm_provider": llm_provider,
                "overall_rating": round(overall_rating, 2),
                "kpi": round(kpi, 2),
                "script_id": script_id,
            },
        )

        # Publish event for real-time notifications
        await publish_analysis_completed(call_id, overall_rating)

        # 5.5 Write back to CRM
        if call.get('external_id'):
            crm_integration = next((i for i in integrations if i.get("integration_type") == "amocrm"), None)
            if crm_integration:
                creds = crm_integration.get("credentials", {})
                if isinstance(creds, str):
                    try:
                        creds = json.loads(creds)
                    except:
                        pass

                cfg = crm_integration.get("config", {})
                if isinstance(cfg, str):
                    try:
                        cfg = json.loads(cfg)
                    except:
                        pass

                if isinstance(creds, dict) and isinstance(cfg, dict):
                    client_id = creds.get("client_id")
                    client_secret = creds.get("client_secret")
                    subdomain = cfg.get("subdomain")

                    logger.info("writing back analysis to CRM", extra={"call_id": call_id, "external_id": call['external_id'], "crm": "amocrm"})
                    # Update client with dynamic credentials if provided
                    # For simplicity, we pass them to the method if the client doesn't hold state,
                    # but here we'll update the client instance for this call.
                    self.crm_client.api_key = client_secret # AmoCRM logic varies, but we follow existing client structure
                    if subdomain:
                        self.crm_client.api_url = f"https://{subdomain}.amocrm.ru/api/v1"

                    await self.crm_client.write_back_analysis(
                        call_id=call_id,
                        external_call_id=call['external_id'],
                        analysis=report
                    )

        # 6. Check for Critical Errors
        await self._check_critical_errors(call_id, manager_id, transcript_text)

    def _validate_llm_response(self, analysis: dict, call_id: str):
        required_fields = ['qualityOfCall', 'scriptMatch', 'errorsFree', 'recommendation', 'brief', 'nextBestAction']
        numeric_fields = ['qualityOfCall', 'scriptMatch', 'errorsFree']
        string_fields = {
            'recommendation': 1,
            'brief': 1,
            'nextBestAction': 1,
        }

        missing = [f for f in required_fields if f not in analysis]
        if missing:
            raise ValueError(f"LLM response missing required fields: {missing} for call_id={call_id}")

        for field in numeric_fields:
            value = analysis[field]
            if not isinstance(value, (int, float)):
                try:
                    analysis[field] = float(value)
                except (ValueError, TypeError):
                    raise ValueError(f"LLM response field '{field}' must be numeric, got {type(value)} for call_id={call_id}")

            if not (0 <= analysis[field] <= 100):
                # Clamp value to [0, 100] instead of failing
                analysis[field] = max(0, min(100, analysis[field]))

        for field, min_len in string_fields.items():
            value = analysis[field]
            if not isinstance(value, str):
                analysis[field] = str(value)
                value = analysis[field]

            if len(value.strip()) < min_len:
                raise ValueError(f"LLM response field '{field}' too short for call_id={call_id}")

        logger.debug("LLM response validated", extra={"call_id": call_id})

    async def _check_critical_errors(self, call_id, manager_id, transcript_text):
        critical_keywords = ["sue", "litigation", "lawyer", "court", "legal action"]
        found = [kw for kw in critical_keywords if kw in transcript_text.lower()]

        if found:
            logger.warning("critical keywords detected",
                           extra={"call_id": call_id, "manager_id": manager_id, "keywords": found})
            message = f"A critical error (mentions of {', '.join(found)}) was detected in call {call_id}."
            
            # Try to get admin
            admin = get_admin_user()
            if admin:
                create_notification(
                    user_id=admin['id'],
                    n_type="in_app",
                    subject="Critical Error Detected",
                    message=message
                )

            # Real-time notification
            await publish_critical_error(call_id, "litigation_threat", message)

    def _format_transcript(self, segments):
        if not segments:
            return ""
        lines = []
        for seg in segments:
            speaker = seg.get('speaker', 'Unknown')
            text = seg.get('text', '')
            lines.append(f"[{speaker}]: {text}")
        return "\n".join(lines)
