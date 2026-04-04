import os
import asyncio
import logging
from typing import Dict, Any, Optional
from src.core.ports.stt_provider import STTProvider
from src.core.utils.text_processor import format_transcript, SonioxTranscriptProcessor

try:
    from soniox import SonioxClient
    from soniox.types import CreateTranscriptionConfig
    SONIOX_AVAILABLE = True
except ImportError:
    SONIOX_AVAILABLE = False

logger = logging.getLogger(__name__)

class SonioxSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("SONIOX_API_KEY")
        if not self.api_key:
             logger.warning("SONIOX_API_KEY is not set")
        self.model = model or "stt-async-v4"

    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        if not SONIOX_AVAILABLE:
            raise RuntimeError("Soniox SDK not installed. Please run 'pip install soniox'")
        if not self.api_key:
            raise RuntimeError("Soniox API key missing")

        try:
            def sync_transcribe():
                client = SonioxClient(api_key=self.api_key)

                config = CreateTranscriptionConfig(
                    enable_speaker_diarization=True
                )
                if language:
                    config.language_hints = [language]

                # Use audio_url if provided, otherwise use local file
                if audio_url:
                    logger.info(f"Transcribing with Soniox from URL: {audio_url}", extra={"model": self.model, "language": language})
                    transcription = client.stt.transcribe(
                        audio_url=audio_url,
                        model=self.model,
                        config=config
                    )
                else:
                    logger.info(f"Transcribing with Soniox from file: {audio_path}", extra={"model": self.model, "language": language})
                    transcription = client.stt.transcribe(
                        file=audio_path,
                        model=self.model,
                        config=config
                    )

                # Wait until transcription processing is finished
                client.stt.wait(transcription.id)

                # Get transcription transcript
                return client.stt.get_transcript(transcription.id)

            result = await asyncio.to_thread(sync_transcribe)

            # Use the professional SonioxTranscriptProcessor
            segments = SonioxTranscriptProcessor.process(result, language=language)

            # Format transcript for the final output using the refined utility
            final_text = format_transcript(segments, language=language)

            logger.info("Soniox transcription completed", extra={"text_length": len(final_text), "segments": len(segments)})

            return {
                "text": final_text,
                "segments": segments,
                "is_diarized": any("Speaker" in s.get("speaker", "UNKNOWN") for s in segments)
            }
        except Exception as e:
            logger.error("Soniox STT failed", extra={"error": str(e), "audio_path": audio_path, "audio_url": audio_url})
            raise RuntimeError(f"Soniox STT failed: {str(e)}") from e

    async def get_models(self) -> list:
        if not SONIOX_AVAILABLE or not self.api_key:
             return ["stt-async-v4", "stt-async-v3", "stt-realtime-v4", "stt-realtime-v3"]

        try:
            def sync_get_models():
                client = SonioxClient(api_key=self.api_key)
                return client.models.list().models

            models = await asyncio.to_thread(sync_get_models)
            return [m.id for m in models if m.transcription_mode == "async"]
        except Exception as e:
            logger.error(f"Failed to fetch Soniox models: {e}")
            return ["stt-async-v4"]

    def supports_url_transcription(self, url: str) -> bool:
        """Soniox supports direct transcription from HTTP/HTTPS URLs."""
        if not url:
            return False
        return url.startswith("http://") or url.startswith("https://")
