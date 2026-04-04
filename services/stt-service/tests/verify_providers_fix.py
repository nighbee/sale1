import sys
import unittest
from unittest.mock import MagicMock, patch
import asyncio
import os

# Mock soniox and elevenlabs BEFORE importing providers
sys.modules['soniox'] = MagicMock()
sys.modules['soniox.types'] = MagicMock()
sys.modules['elevenlabs'] = MagicMock()
sys.modules['elevenlabs.client'] = MagicMock()

from src.adapters.stt.soniox_provider import SonioxSTTProvider
from src.adapters.stt.elevenlabs_provider import ElevenLabsSTTProvider

class TestProviders(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        # Create a dummy file for transcription
        with open("dummy_audio.wav", "wb") as f:
            f.write(b"dummy audio data")

    def tearDown(self):
        self.loop.close()
        if os.path.exists("dummy_audio.wav"):
            os.remove("dummy_audio.wav")

    @patch("src.adapters.stt.soniox_provider.SonioxClient")
    def test_soniox_transcribe(self, MockClient):
        mock_client_instance = MockClient.return_value

        # Mock transcription object
        mock_transcription = MagicMock()
        mock_transcription.id = "test_id"
        mock_client_instance.stt.transcribe.return_value = mock_transcription

        # Mock transcript object
        mock_transcript = MagicMock()
        mock_transcript.text = "Hello world"

        token1 = MagicMock()
        token1.text = "Hello"
        token1.start_ms = 0
        token1.end_ms = 500
        token1.speaker_id = 1

        token2 = MagicMock()
        token2.text = "world"
        token2.start_ms = 600
        token2.end_ms = 1000
        token2.speaker_id = 1

        mock_transcript.tokens = [token1, token2]
        mock_client_instance.stt.get_transcript.return_value = mock_transcript

        provider = SonioxSTTProvider(api_key="test_key")

        result = self.loop.run_until_complete(provider.transcribe("dummy_audio.wav"))

        self.assertEqual(result["text"], "Hello world")
        self.assertEqual(len(result["segments"]), 1)
        self.assertEqual(result["segments"][0]["text"], "Hello world")
        self.assertEqual(result["segments"][0]["speaker"], "SPEAKER_1")

    @patch("src.adapters.stt.elevenlabs_provider.ElevenLabs")
    def test_elevenlabs_permission_error(self, MockElevenLabs):
        mock_client_instance = MockElevenLabs.return_value
        # Simulate permission error
        mock_client_instance.speech_to_text.convert.side_effect = Exception("missing_permissions: speech_to_text")

        provider = ElevenLabsSTTProvider(api_key="test_key")

        with self.assertRaises(RuntimeError) as cm:
            self.loop.run_until_complete(provider.transcribe("dummy_audio.wav"))

        self.assertIn("API key missing `speech_to_text` permission", str(cm.exception))

if __name__ == "__main__":
    unittest.main()
