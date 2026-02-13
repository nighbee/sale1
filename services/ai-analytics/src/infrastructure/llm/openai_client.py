import json
import logging

logger = logging.getLogger(__name__)

class MockLLMClient:
    async def analyze(self, system_prompt: str, user_prompt: str) -> dict:
        logger.info("Mock LLM client called")
        # Returning mock analysis data
        is_critical = "sue" in user_prompt.lower() or "legal" in user_prompt.lower()
        return {
            "quality_score": 85 if not is_critical else 10,
            "script_match": 70,
            "errors_free": 90 if not is_critical else 0,
            "overall_rating": 81.5 if not is_critical else 20.0,
            "recommendation": "Great job, but try to use more positive words. Mention the discount more clearly.",
            "brief": "The manager discussed the main features of the product and handled the price objection successfully.",
            "next_best_action": "Send the follow-up email with the case study.",
            "critical_error_detected": is_critical,
            "critical_error_message": "Client threatened with legal action" if is_critical else None
        }
