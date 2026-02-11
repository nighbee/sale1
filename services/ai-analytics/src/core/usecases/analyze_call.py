import logging
from src.adapters.storage.postgres_repo import get_transcript, get_call, get_active_script, save_analysis
from src.infrastructure.llm.openai_client import MockLLMClient

logger = logging.getLogger(__name__)

class AnalyzeCallUseCase:
    def __init__(self):
        self.llm = MockLLMClient()

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
        system_prompt = "You are a sales analyst. Analyze the transcript against the script."

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
            'llm_provider': 'mock-openai'
        }

        save_analysis(report)
        logger.info(f"Analysis saved for call {call_id}")

    def _format_transcript(self, segments):
        if not segments:
            return ""
        lines = []
        for seg in segments:
            speaker = seg.get('speaker', 'Unknown')
            text = seg.get('text', '')
            lines.append(f"[{speaker}]: {text}")
        return "\n".join(lines)
