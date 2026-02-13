import logging
import json
from src.adapters.storage.postgres_repo import get_transcript, get_call, get_active_script, save_analysis, create_notification, get_tenant_admins
from src.infrastructure.llm.openai_client import MockLLMClient
from src.adapters.events.notification_adapter import NotificationAdapter

logger = logging.getLogger(__name__)

class AnalyzeCallUseCase:
    def __init__(self):
        self.llm = MockLLMClient()
        self.notifier = NotificationAdapter()

    async def execute(self, call_id: str, company_id: str):
        logger.info(f"Analyzing call {call_id} for company {company_id}")

        # 1. Fetch data
        transcript = get_transcript(call_id)
        if not transcript:
            logger.error(f"Transcript not found for call {call_id}")
            return

        call = get_call(call_id)
        if not call:
            logger.error(f"Call not found for {call_id}")
            return

        script = get_active_script(company_id)
        script_text = script['parsed_text'] if script else "No active script found."
        script_id = script['id'] if script else None

        # 2. Prepare prompt
        transcript_text = self._format_transcript(transcript['speaker_diarized_json'])
        user_prompt = f"TRANSCRIPT:\n{transcript_text}\n\nSCRIPT:\n{script_text}"
        system_prompt = (
            "You are a sales analyst. Analyze the transcript against the script. "
            "PII Redaction: Ignore and redact any credit card numbers or sensitive personal info. "
            "Extract topics discussed in the call."
        )

        # 3. Call LLM (Mocked)
        analysis = await self.llm.analyze(system_prompt, user_prompt)

        # 4. Calculate KPI
        # KPI = (quality*0.4 + script_match*0.4 + errors_free*0.2) * (duration/60)
        quality = analysis['quality_score']
        script_match = analysis['script_match']
        errors_free = analysis['errors_free']
        duration = call['duration']

        overall_rating = quality * 0.4 + script_match * 0.4 + errors_free * 0.2
        kpi = overall_rating * (duration / 60.0)

        # 5. Save report
        report = {
            'call_id': call_id,
            'script_id': script_id,
            'quality_score': quality,
            'script_match': script_match,
            'errors_free': errors_free,
            'overall_rating': overall_rating,
            'kpi': round(kpi, 2),
            'recommendation': analysis['recommendation'],
            'brief': analysis['brief'],
            'next_best_action': analysis['next_best_action'],
            'llm_provider': 'openai',
            'topics': json.dumps(["Pricing", "Features", "Contract"]) # Mocked topics
        }

        save_analysis(report)
        logger.info(f"Analysis saved for call {call_id}")

        # 6. Critical Error Notification
        if analysis.get('critical_error_detected'):
            logger.warning(f"Critical error detected in call {call_id}: {analysis['critical_error_message']}")
            admins = get_tenant_admins(company_id)
            for admin in admins:
                create_notification(
                    admin['id'],
                    'in_app',
                    f"CRITICAL ERROR in call {call_id}: {analysis['critical_error_message']}"
                )
                # Send external alerts
                await self.notifier.send_telegram(admin['id'], f"CRITICAL: {analysis['critical_error_message']}")
                await self.notifier.send_email(admin['id'], "Critical Error Alert", f"A critical error was detected: {analysis['critical_error_message']}")

    def _format_transcript(self, segments):
        if not segments:
            return ""
        lines = []
        for seg in segments:
            speaker = seg.get('speaker', 'Unknown')
            text = seg.get('text', '')
            lines.append(f"[{speaker}]: {text}")
        return "\n".join(lines)
