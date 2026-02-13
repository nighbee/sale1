import logging
import os
from src.adapters.storage.postgres_repo import (
    get_transcript, get_call, get_active_script, save_analysis,
    create_notification, get_company_admin, get_company_settings
)
from src.infrastructure.llm.openai_client import OpenAIClient
from src.infrastructure.llm.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

class AnalyzeCallUseCase:
    def __init__(self):
        self.openai_client = OpenAIClient()
        self.gemini_client = GeminiClient()

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

        system_prompt = """
        You are a sales quality analyst. Analyze the call transcript against the provided sales script.

        You must output a JSON object with the following fields:
        {
          "quality_score": (integer 0-100, based on tone, clarity, professionalism),
          "script_match": (integer 0-100, based on adherence to script phases and keywords),
          "errors_free": (integer 0-100, 100 if no rude language or prohibited words found),
          "recommendation": (string, 3 sentences of actionable feedback),
          "brief": (string, 3 sentence summary of the call),
          "next_best_action": (string, one concrete next step for the representative)
        }
        """

        # 3. Call LLM
        settings = get_company_settings(company_id)
        llm_provider = settings['llm_provider'] if settings else "openai"

        if llm_provider == "gemini":
            analysis = await self.gemini_client.analyze(system_prompt, user_prompt)
        else:
            analysis = await self.openai_client.analyze(system_prompt, user_prompt)

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
            'recommendation': analysis.get('recommendation', ''),
            'brief': analysis.get('brief', ''),
            'next_best_action': analysis.get('next_best_action', ''),
            'llm_provider': llm_provider
        }

        save_analysis(report)
        logger.info(f"Analysis saved for call {call_id}")

        # 6. Check for Critical Errors
        self._check_critical_errors(call_id, company_id, transcript_text)

    def _check_critical_errors(self, call_id, company_id, transcript_text):
        critical_keywords = ["sue", "litigation", "lawyer", "court", "legal action"]
        found = [kw for kw in critical_keywords if kw in transcript_text.lower()]

        if found:
            logger.warning(f"CRITICAL ERROR DETECTED in call {call_id}: {found}")
            admin = get_company_admin(company_id)
            if admin:
                create_notification(
                    user_id=admin['id'],
                    n_type="in_app",
                    subject="Critical Error Detected",
                    message=f"A critical error (mentions of {', '.join(found)}) was detected in call {call_id}."
                )

    def _format_transcript(self, segments):
        if not segments:
            return ""
        lines = []
        for seg in segments:
            speaker = seg.get('speaker', 'Unknown')
            text = seg.get('text', '')
            lines.append(f"[{speaker}]: {text}")
        return "\n".join(lines)
