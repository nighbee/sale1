import logging
import os
from src.adapters.storage.postgres_repo import (
    get_transcript, get_call, get_active_script, get_team_script, save_analysis,
    create_notification, get_company_admin, get_company_settings
)
from src.infrastructure.llm.openai_client import OpenAIClient
from src.infrastructure.llm.gemini_client import GeminiClient
from src.adapters.events.redis_publisher import publish_analysis_completed, publish_critical_error

logger = logging.getLogger(__name__)

class AnalyzeCallUseCase:
    def __init__(self):
        self.openai_client = OpenAIClient()
        self.gemini_client = GeminiClient()

    async def execute(self, call_id: str, company_id: str):
        logger.info("analyzing call", extra={"call_id": call_id, "company_id": company_id})

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
        script = get_team_script(company_id, manager_id)
        script_text = script['parsed_text'] if script else "No active script found."
        script_id = script['id'] if script else None

        # 2. Prepare prompt
        transcript_text = self._format_transcript(transcript['speaker_diarized_json'])
        transcript_segments = transcript['speaker_diarized_json'] or []
        user_prompt = f"TRANSCRIPT:\n{transcript_text}\n\nSCRIPT:\n{script_text}"

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

        system_prompt = """
        You are a sales quality analyst. Analyze the call transcript against the provided sales script.

        You must output a JSON object with exactly the following fields (no additional fields allowed):
        {
          "qualityOfCall": (number 0-100, overall call quality based on tone, clarity, professionalism),
          "scriptMatch": (number 0-100, adherence to required steps and script guidelines),
          "errorsFree": (number 0-100, 100 means no incorrect promises, policy violations or data errors),
          "recommendation": (string, 3-6 sentences of concrete improvement recommendations for the agent),
          "brief": (string, 2-5 sentence summary of the conversation essence),
          "nextBestAction": (string, 1-3 bulleted next steps for the representative)
        }
        """

        # 3. Call LLM
        settings = get_company_settings(company_id)
        llm_provider = settings['llm_provider'] if settings else "openai"

        logger.info(
            "[2/4] sending to LLM",
            extra={
                "call_id": call_id,
                "llm_provider": llm_provider,
                "prompt_chars": len(system_prompt) + len(user_prompt),
            },
        )

        if llm_provider == "gemini":
            analysis = await self.gemini_client.analyze(system_prompt, user_prompt)
        else:
            analysis = await self.openai_client.analyze(system_prompt, user_prompt)

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
        # KPI = (quality*0.4 + script_match*0.4 + errors_free*0.2) * (duration/60)
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
            'llm_provider': llm_provider
        }

        save_analysis(report)
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

        # 6. Check for Critical Errors
        await self._check_critical_errors(call_id, company_id, transcript_text)

    def _validate_llm_response(self, analysis: dict, call_id: str):
        required_fields = ['qualityOfCall', 'scriptMatch', 'errorsFree', 'recommendation', 'brief', 'nextBestAction']
        numeric_fields = ['qualityOfCall', 'scriptMatch', 'errorsFree']
        string_fields = {
            'recommendation': 10,
            'brief': 10,
            'nextBestAction': 5,
        }

        missing = [f for f in required_fields if f not in analysis]
        if missing:
            raise ValueError(f"LLM response missing required fields: {missing} for call_id={call_id}")

        for field in numeric_fields:
            value = analysis[field]
            if not isinstance(value, (int, float)):
                raise ValueError(f"LLM response field '{field}' must be numeric, got {type(value)} for call_id={call_id}")
            if not (0 <= value <= 100):
                raise ValueError(f"LLM response field '{field}' out of range [0, 100]: {value} for call_id={call_id}")

        for field, min_len in string_fields.items():
            value = analysis[field]
            if not isinstance(value, str) or len(value.strip()) < min_len:
                raise ValueError(f"LLM response field '{field}' too short or not a string for call_id={call_id}")

        logger.debug("LLM response validated", extra={"call_id": call_id})

    async def _check_critical_errors(self, call_id, company_id, transcript_text):
        critical_keywords = ["sue", "litigation", "lawyer", "court", "legal action"]
        found = [kw for kw in critical_keywords if kw in transcript_text.lower()]

        if found:
            logger.warning("critical keywords detected",
                           extra={"call_id": call_id, "company_id": company_id, "keywords": found})
            message = f"A critical error (mentions of {', '.join(found)}) was detected in call {call_id}."
            admin = get_company_admin(company_id)
            if admin:
                create_notification(
                    user_id=admin['id'],
                    n_type="in_app",
                    subject="Critical Error Detected",
                    message=message
                )

            # Real-time notification
            await publish_critical_error(call_id, company_id, "litigation_threat", message)

    def _format_transcript(self, segments):
        if not segments:
            return ""
        lines = []
        for seg in segments:
            speaker = seg.get('speaker', 'Unknown')
            text = seg.get('text', '')
            lines.append(f"[{speaker}]: {text}")
        return "\n".join(lines)
