import logging
import httpx
import asyncio
import os

logger = logging.getLogger(__name__)

class AmoCRMClient:
    def __init__(self):
        self.api_url = os.getenv("AMOCRM_API_URL", "https://amocrm.salesai.local/api/v1")
        self.api_key = os.getenv("AMOCRM_API_KEY")

    async def write_back_analysis(self, call_id: str, external_call_id: str, analysis: dict):
        """
        Writes the analysis results back to AmoCRM.
        Implements retry logic with exponential backoff.
        """
        if not self.api_key:
            logger.warning("AMOCRM_API_KEY not set, skipping write-back", extra={"call_id": call_id})
            return

        payload = {
            "call_id": call_id,
            "external_call_id": external_call_id,
            "overall_rating": analysis.get("overall_rating"),
            "quality_score": analysis.get("quality_score"),
            "script_match": analysis.get("script_match"),
            "brief": analysis.get("brief"),
            "recommendation": analysis.get("recommendation"),
            "next_best_action": analysis.get("next_best_action"),
        }

        max_retries = 3
        async with httpx.AsyncClient(timeout=10.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await client.post(
                        f"{self.api_url}/calls/analysis-sync",
                        json=payload,
                        headers={"X-API-KEY": self.api_key}
                    )
                    response.raise_for_status()
                    logger.info(
                        "successfully wrote back to AmoCRM",
                        extra={"call_id": call_id, "external_call_id": external_call_id}
                    )
                    return
                except Exception as e:
                    wait_time = 2 ** attempt
                    logger.warning(
                        "failed to write back to AmoCRM, retrying",
                        extra={
                            "call_id": call_id,
                            "attempt": attempt + 1,
                            "error": str(e),
                            "wait_time": wait_time
                        }
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(
                            "exhausted retries for AmoCRM write-back",
                            extra={"call_id": call_id, "error": str(e)}
                        )
