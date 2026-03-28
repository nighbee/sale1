import logging
import json
from typing import Dict, Any, List
from src.core.ports.llm_provider import LLMProvider
from src.infrastructure.llm.openai_client import OpenAIClient
from src.infrastructure.llm.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

class OpenAILLMProvider(LLMProvider):
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        self.client = OpenAIClient(api_key=api_key, base_url=base_url, model=model)

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        return await self.client.analyze(system_prompt, user_prompt, model=model)

class GeminiLLMProvider(LLMProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.client = GeminiClient(api_key=api_key, model=model)

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        return await self.client.analyze(system_prompt, user_prompt, model=model)

class LLMProviderFactory:
    @staticmethod
    def create(provider_name: str, integrations: List[Dict[str, Any]], default_model: str = None) -> LLMProvider:
        # Look for integration that matches provider_name
        integration = next((i for i in integrations if i.get("integration_type") == provider_name), None)

        api_key = None
        base_url = None
        if integration:
            creds = integration.get("credentials", {})
            if isinstance(creds, str):
                try:
                    creds = json.loads(creds)
                except:
                    pass
            if isinstance(creds, dict):
                api_key = creds.get("api_key")
                base_url = creds.get("base_url")

        logger.info(
            "Initializing LLM provider",
            extra={
                "provider": provider_name,
                "has_integration": integration is not None,
                "has_api_key": bool(api_key),
                "has_base_url": bool(base_url),
            },
        )

        if provider_name == "gemini":
            return GeminiLLMProvider(api_key=api_key, model=default_model)
        else:
            # Default to OpenAI-compatible provider
            return OpenAILLMProvider(api_key=api_key, base_url=base_url, model=default_model)
