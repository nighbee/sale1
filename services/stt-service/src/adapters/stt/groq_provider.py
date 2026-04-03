import os
import asyncio
import logging
from typing import Optional
from openai import AsyncOpenAI
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class GroqSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
             logger.warning("GROQ_API_KEY is not set")
        self.client = AsyncOpenAI(
            api_key=self.api_key or "sk-dummy",
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = model or os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")

    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        if not self.api_key:
            raise RuntimeError("Groq API key missing")

        try:
            logger.info(f"Transcribing with Groq: {audio_path}", extra={"language": language})

            audio_buffer = await asyncio.to_thread(self._read_file, audio_path)

            kwargs = {
                "model": self.model,
                "file": ("audio.mp3", audio_buffer),
                "response_format": "verbose_json",
                "timestamp_granularities": ["segment"],
            }
            if language:
                kwargs["language"] = language

            transcript = await self.client.audio.transcriptions.create(**kwargs)

            segments = []
            if hasattr(transcript, "segments") and transcript.segments:
                for seg in transcript.segments:
                    if isinstance(seg, dict):
                        segments.append({
                            "start": seg.get("start") or 0.0,
                            "end": seg.get("end") or 0.0,
                            "text": seg.get("text") or "",
                        })
                    else:
                        segments.append({
                            "start": getattr(seg, "start", 0.0) or 0.0,
                            "end": getattr(seg, "end", 0.0) or 0.0,
                            "text": getattr(seg, "text", "") or "",
                        })

            logger.info(f"Groq transcription complete", extra={"audio_path": audio_path, "segments": len(segments)})

            return {
                "text": transcript.text,
                "segments": segments,
            }
        except Exception as e:
            logger.error("Groq STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"Groq STT failed: {str(e)}") from e

    def _read_file(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()
