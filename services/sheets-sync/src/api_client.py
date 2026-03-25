import requests
import logging
import os
from src.config import Config

logger = logging.getLogger(__name__)

class MainAPIClient:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or Config.MAIN_API_URL
        self.internal_secret = os.getenv("INTERNAL_SECRET", "internal-secret-key")

    def get_active_integrations(self):
        url = f"{self.base_url}/api/v1/internal/integrations"
        try:
            # We use a shared internal secret for basic authentication between services
            headers = {"X-Internal-Secret": self.internal_secret}
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json().get("integrations", [])
        except Exception as e:
            logger.error("Failed to fetch active integrations from main-api", extra={"url": url, "error": str(e)})
            return []
