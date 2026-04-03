import os
import asyncio
import logging
from typing import Dict, Any, Optional
from src.core.ports.stt_provider import STTProvider

try:
    from soniox import SonioxClient
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

                # Use audio_url if provided, otherwise use local file
                if audio_url:
                    logger.info(f"Transcribing with Soniox from URL: {audio_url}", extra={"model": self.model, "language": language})
                    transcription = client.stt.transcribe(
                        audio_url=audio_url,
                        model=self.model,
                        language=language
                    )
                else:
                    logger.info(f"Transcribing with Soniox from file: {audio_path}", extra={"model": self.model, "language": language})
                    with open(audio_path, "rb") as f:
                        transcription = client.stt.transcribe(
                            file=f,
                            model=self.model,
                            language=language
                        )

                # Wait until transcription processing is finished
                client.stt.wait(transcription.id)

                # Get transcription transcript
                return client.stt.get_transcript(transcription.id)

            result = await asyncio.to_thread(sync_transcribe)

            segments = []
            # Soniox result has text and can have channels/segments/words
            # We'll try to extract segments if available
            if hasattr(result, "channels"):
                for channel in result.channels:
                    if hasattr(channel, "segments"):
                        for seg in channel.segments:
                            segments.append({
                                "start": getattr(seg, "start_ms", 0) / 1000.0,
                                "end": getattr(seg, "end_ms", 0) / 1000.0,
                                "text": getattr(seg, "text", ""),
                                "speaker": f"SPEAKER_{getattr(seg, 'speaker', 'UNKNOWN')}"
                            })

            # Fallback if no segments found but we have text
            if not segments and result.text:
                segments.append({
                    "start": 0.0,
                    "end": 0.0, # Unknown duration here
                    "text": result.text,
                    "speaker": "UNKNOWN"
                })

            logger.info("Soniox transcription completed", extra={"text_length": len(result.text), "segments": len(segments)})

            return {
                "text": result.text,
                "segments": segments,
                "is_diarized": any(s.get("speaker") != "SPEAKER_UNKNOWN" for s in segments)
            }
        except Exception as e:
            logger.error("Soniox STT failed", extra={"error": str(e), "audio_path": audio_path, "audio_url": audio_url})
            raise RuntimeError(f"Soniox STT failed: {str(e)}") from e
