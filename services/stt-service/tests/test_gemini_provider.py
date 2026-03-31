import pytest
import json
from unittest.mock import MagicMock, AsyncMock, patch
from src.adapters.stt.gemini_provider import GeminiSTTProvider

@pytest.mark.asyncio
async def test_gemini_transcribe_structured_json():
    # Mocking genai configuration and model
    with patch('google.generativeai.configure'), \
         patch('google.generativeai.GenerativeModel') as MockModel, \
         patch('google.generativeai.upload_file', create=True) as MockUpload, \
         patch('google.generativeai.delete_file', create=True) as MockDelete:

        mock_model_instance = MockModel.return_value
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "text": "Hello world",
            "segments": [{"start": 0.0, "end": 1.0, "text": "Hello world"}]
        })
        mock_model_instance.generate_content_async = AsyncMock(return_value=mock_response)

        MockUpload.return_value = MagicMock(name="sample_file")

        provider = GeminiSTTProvider(api_key="test_key", model="gemini-pro")
        result = await provider.transcribe("fake_audio.mp3")

        assert result["text"] == "Hello world"
        assert len(result["segments"]) == 1
        assert result["segments"][0]["text"] == "Hello world"

        # Verify call parameters
        args, kwargs = mock_model_instance.generate_content_async.call_args
        assert kwargs["generation_config"] == {"response_mime_type": "application/json"}

@pytest.mark.asyncio
async def test_gemini_transcribe_fallback_to_raw_text():
    # Mocking genai configuration and model
    with patch('google.generativeai.configure'), \
         patch('google.generativeai.GenerativeModel') as MockModel, \
         patch('google.generativeai.upload_file', create=True) as MockUpload, \
         patch('google.generativeai.delete_file', create=True) as MockDelete:

        mock_model_instance = MockModel.return_value
        mock_response = MagicMock()
        mock_response.text = "This is not JSON but raw text"
        mock_model_instance.generate_content_async = AsyncMock(return_value=mock_response)

        MockUpload.return_value = MagicMock(name="sample_file")

        provider = GeminiSTTProvider(api_key="test_key")
        result = await provider.transcribe("fake_audio.mp3")

        assert result["text"] == "This is not JSON but raw text"
        assert result["segments"] == []
