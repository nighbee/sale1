import pytest
from unittest.mock import MagicMock, patch
from src.adapters.stt.factory import STTProviderFactory
from src.adapters.stt.deepgram_provider import DeepgramSTTProvider
from src.adapters.stt.gemini_provider import GeminiSTTProvider
from src.adapters.stt.groq_provider import GroqSTTProvider
from src.adapters.stt.elevenlabs_provider import ElevenLabsSTTProvider
from src.adapters.stt.soniox_provider import SonioxSTTProvider
from src.adapters.stt.openai_provider import OpenAISTTProvider

def test_factory_creates_providers_with_custom_model():
    integrations = [
        {"integration_type": "deepgram", "credentials": {"api_key": "test_key"}},
        {"integration_type": "gemini", "credentials": {"api_key": "test_key"}},
        {"integration_type": "groq", "credentials": {"api_key": "test_key"}},
        {"integration_type": "elevenlabs", "credentials": {"api_key": "test_key"}},
        {"integration_type": "soniox", "credentials": {"api_key": "test_key"}},
        {"integration_type": "openai", "credentials": {"api_key": "test_key"}},
    ]

    # Test Deepgram
    provider = STTProviderFactory.create("deepgram", integrations, default_model="custom-deepgram-model")
    assert isinstance(provider, DeepgramSTTProvider)
    assert provider.model == "custom-deepgram-model"

    # Test Gemini
    provider = STTProviderFactory.create("gemini", integrations, default_model="custom-gemini-model")
    assert isinstance(provider, GeminiSTTProvider)
    assert provider.model_name == "custom-gemini-model"

    # Test Groq
    provider = STTProviderFactory.create("groq", integrations, default_model="custom-groq-model")
    assert isinstance(provider, GroqSTTProvider)
    assert provider.model == "custom-groq-model"

    # Test ElevenLabs
    provider = STTProviderFactory.create("elevenlabs", integrations, default_model="custom-eleven-model")
    assert isinstance(provider, ElevenLabsSTTProvider)
    assert provider.model == "custom-eleven-model"

    # Test Soniox
    provider = STTProviderFactory.create("soniox", integrations, default_model="custom-soniox-model")
    assert isinstance(provider, SonioxSTTProvider)
    assert provider.model == "custom-soniox-model"

    # Test OpenAI (default case)
    provider = STTProviderFactory.create("openai", integrations, default_model="custom-openai-model")
    assert isinstance(provider, OpenAISTTProvider)
    assert provider.model == "custom-openai-model"

def test_factory_uses_defaults_when_model_not_provided():
    integrations = [{"integration_type": "deepgram", "credentials": {"api_key": "test_key"}}]

    provider = STTProviderFactory.create("deepgram", integrations)
    assert isinstance(provider, DeepgramSTTProvider)
    # nova-2 is the default in DeepgramSTTProvider
    assert provider.model == "nova-2"
