import os
import asyncio
import logging
from typing import Dict, Any
from src.core.ports.stt_provider import STTProvider

# Note: In a real scenario, we would use 'soniox' library
# For this task, we assume the library and its usage.
try:
    from soniox.transcribe_file import transcribe_file_short
    from soniox.speech_client import SpeechClient
    SONIOX_AVAILABLE = True
except ImportError:
    SONIOX_AVAILABLE = False

logger = logging.getLogger(__name__)

class SonioxSTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("SONIOX_API_KEY")
        if not self.api_key:
             logger.warning("SONIOX_API_KEY is not set")

    async def transcribe(self, audio_path: str) -> dict:
        if not SONIOX_AVAILABLE:
            raise RuntimeError("Soniox SDK not installed")
        if not self.api_key:
            raise RuntimeError("Soniox API key missing")

        try:
            logger.info(f"Transcribing with Soniox: {audio_path}")

            # Using asyncio.to_thread for blocking SDK calls
            def sync_transcribe():
                with SpeechClient(api_key=self.api_key) as client:
                    return transcribe_file_short(client, audio_path)

            result = await asyncio.to_thread(sync_transcribe)

            segments = []
            full_text = ""

            for word in result.words:
                # Soniox returns word-level info. We can aggregate or keep as is.
                # Simplified for demonstration:
                full_text += word.text + " "

            # Assuming Soniox has a way to get segments or we construct them
            # Here we just put the whole text as one segment for simplicity if no segments returned
            segments = [{
                "start": 0.0,
                "end": 0.0, # Would need real duration
                "text": full_text.strip(),
                "speaker": "UNKNOWN"
            }]

            logger.info(f"Soniox transcription completed", extra={"text_length": len(full_text)})

            return {
                "text": full_text.strip(),
                "segments": segments,
                "is_diarized": False
            }
        except Exception as e:
            logger.error("Soniox STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"Soniox STT failed: {str(e)}") from e
