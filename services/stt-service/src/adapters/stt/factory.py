import os
import json
import logging
from typing import List, Dict, Any
from src.core.ports.stt_provider import STTProvider
from src.adapters.stt.openai_provider import OpenAISTTProvider
from src.adapters.stt.gemini_provider import GeminiSTTProvider
from src.adapters.stt.groq_provider import GroqSTTProvider
from src.adapters.stt.deepgram_provider import DeepgramSTTProvider
from src.adapters.stt.elevenlabs_provider import ElevenLabsSTTProvider

logger = logging.getLogger(__name__)

class STTProviderFactory:
    @staticmethod
    def create(provider_name: str, integrations: List[Dict[str, Any]], default_model: str = None) -> STTProvider:
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
            "Initializing STT provider",
            extra={
                "provider": provider_name,
                "has_integration": integration is not None,
                "has_api_key": bool(api_key),
                "has_base_url": bool(base_url),
            },
        )

        if provider_name == "gemini":
            return GeminiSTTProvider(api_key=api_key)
        elif provider_name == "groq":
            return GroqSTTProvider(api_key=api_key)
        elif provider_name == "deepgram":
            return DeepgramSTTProvider(api_key=api_key)
        elif provider_name == "elevenlabs":
            return ElevenLabsSTTProvider(api_key=api_key)
        else:
            # Default to OpenAI-compatible provider
            model = default_model or "whisper-1"
            return OpenAISTTProvider(api_key=api_key, base_url=base_url, model=model)
