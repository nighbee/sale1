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
                integrations = response.json().get("integrations", [])
                logger.info(
                    "Fetched active integrations from main-api",
                    extra={
                        "count": len(integrations),
                        "types": [i.get("integration_type") for i in integrations],
                    },
                )
                return integrations
        except Exception as e:
            logger.error("Failed to fetch active integrations from main-api", extra={"url": url, "error": str(e)})
            return []

    async def get_ai_settings(self):
        url = f"{self.base_url}/api/v1/internal/ai-settings"
        try:
            headers = {"X-Internal-Secret": self.internal_secret}
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=5.0)
                response.raise_for_status()
                settings = response.json()
                logger.info("Fetched AI settings from main-api", extra={"stt_provider": settings.get("stt_provider")})
                return settings
        except Exception as e:
            logger.error("Failed to fetch AI settings from main-api", extra={"url": url, "error": str(e)})
            return None
