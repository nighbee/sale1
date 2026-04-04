import asyncio
import unittest
from unittest.mock import MagicMock, patch
from src.adapters.stt.soniox_provider import SonioxSTTProvider
from src.adapters.stt.deepgram_provider import DeepgramSTTProvider
from src.adapters.stt.openai_provider import OpenAISTTProvider

class TestSTTStrategy(unittest.TestCase):
    def test_soniox_supports_url(self):
        provider = SonioxSTTProvider(api_key="test")
        self.assertTrue(provider.supports_url_transcription("http://example.com/audio.mp3"))
        self.assertTrue(provider.supports_url_transcription("https://example.com/audio.mp3"))
        self.assertFalse(provider.supports_url_transcription("minio://bucket/audio.mp3"))
        self.assertFalse(provider.supports_url_transcription(""))
        self.assertFalse(provider.supports_url_transcription(None))

    def test_deepgram_supports_url(self):
        # Patch DeepgramClient to avoid initialization issues
        with patch("src.adapters.stt.deepgram_provider.DeepgramClient"):
            provider = DeepgramSTTProvider(api_key="test")
            self.assertTrue(provider.supports_url_transcription("http://example.com/audio.mp3"))
            self.assertTrue(provider.supports_url_transcription("https://example.com/audio.mp3"))
            self.assertFalse(provider.supports_url_transcription("minio://bucket/audio.mp3"))
            self.assertFalse(provider.supports_url_transcription(""))
            self.assertFalse(provider.supports_url_transcription(None))

    def test_openai_does_not_support_url(self):
        provider = OpenAISTTProvider(api_key="test")
        self.assertFalse(provider.supports_url_transcription("http://example.com/audio.mp3"))

if __name__ == "__main__":
    unittest.main()
