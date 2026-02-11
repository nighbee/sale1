import os
import json
from src.adapters.storage.postgres_repo import get_transcript, get_active_script, save_analysis

class AnalyzeCallUseCase:
    def __init__(self):
        pass

    async def execute(self, call_id: str, company_id: str):
        print(f"Analyzing call {call_id} for company {company_id}...")

        # 1. Fetch transcript from DB
        transcript_json = get_transcript(call_id)
        if not transcript_json:
            print(f"Transcript not found for {call_id}")
            return

        # 2. Fetch company script
        script = get_active_script(company_id)

        # 3. Call LLM (Mocked for now)
        analysis = {
            "quality_score": 85,
            "script_match": 90,
            "errors_free": 95,
            "overall_rating": 89.0,
            "recommendation": "Great job, but try to speak slower.",
            "brief": "Customer inquired about pricing and features.",
            "next_best_action": "Send follow-up email with brochure.",
            "llm_provider": "openai-mock"
        }

        # 4. Calculate KPI
        duration = 300
        kpi = calculate_kpi(analysis['quality_score'], analysis['script_match'], analysis['errors_free'], duration)

        # 5. Save report to DB
        report = {
            "call_id": call_id,
            "script_id": script['id'] if script else None,
            **analysis,
            "kpi": kpi
        }
        save_analysis(report)

        print(f"Analysis completed for {call_id}")
        return {"call_id": call_id, "status": "completed"}

def calculate_kpi(quality: int, script_match: int, errors_free: int, duration: int) -> float:
    overall = (quality * 0.4 + script_match * 0.4 + errors_free * 0.2)
    duration_minutes = duration / 60
    return round(overall * duration_minutes, 1)
