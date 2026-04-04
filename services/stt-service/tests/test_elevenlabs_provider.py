import pytest
from unittest.mock import MagicMock, patch
from src.adapters.stt.factory import STTProviderFactory
from src.adapters.stt.elevenlabs_provider import ElevenLabsSTTProvider

def test_elevenlabs_factory_default_model():
    integrations = [{"integration_type": "elevenlabs", "credentials": {"api_key": "test_key"}}]

    # Test ElevenLabs default model is scribe_v2
    provider = STTProviderFactory.create("elevenlabs", integrations)
    assert isinstance(provider, ElevenLabsSTTProvider)
    assert provider.model == "scribe_v2"

@pytest.mark.asyncio
async def test_elevenlabs_get_models_filtering():
    # Mock model objects with model_id
    mock_model_stt1 = MagicMock()
    mock_model_stt1.model_id = "scribe_v1"

    mock_model_stt2 = MagicMock()
    mock_model_stt2.model_id = "scribe_v2"

    mock_model_tts = MagicMock()
    mock_model_tts.model_id = "eleven_multilingual_v1"

    provider = ElevenLabsSTTProvider(api_key="fake")

    with patch.object(provider.client.models, 'list', return_value=[mock_model_stt1, mock_model_stt2, mock_model_tts]):
        models = await provider.get_models()
        assert "scribe_v1" in models
        assert "scribe_v2" in models
        assert "eleven_multilingual_v1" not in models
