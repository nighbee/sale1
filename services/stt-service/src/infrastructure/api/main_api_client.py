import httpx
import logging
import os

logger = logging.getLogger(__name__)

class MainAPIClient:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("MAIN_API_URL", "http://main-api:8080")
        self.internal_secret = os.getenv("INTERNAL_SECRET", "internal-secret-key")

    async def get_active_integrations(self):
        url = f"{self.base_url}/api/v1/internal/integrations"
        try:
            headers = {"X-Internal-Secret": self.internal_secret}
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)
                response.raise_for_status()
                return response.json().get("integrations", [])
        except Exception as e:
            logger.error("Failed to fetch active integrations from main-api", extra={"url": url, "error": str(e)})
            return []
