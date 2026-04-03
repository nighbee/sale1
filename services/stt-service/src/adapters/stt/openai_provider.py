import os
import logging
import asyncio
from typing import Optional
from openai import AsyncOpenAI
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class OpenAISTTProvider(STTProvider):
    def __init__(self, api_key: str = None, base_url: str = None, model: str = "whisper-1"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
             logger.warning("OPENAI_API_KEY is not set")

        client_kwargs = {"api_key": self.api_key or "sk-dummy"}
        if base_url:
            client_kwargs["base_url"] = base_url

        self.client = AsyncOpenAI(**client_kwargs)
        self.model = model

    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        if not self.api_key:
            raise RuntimeError("OpenAI API key missing")

        try:
            logger.info(f"Transcribing with OpenAI: {audio_path}", extra={"language": language})

            with open(audio_path, "rb") as audio_file:
                kwargs = {
                    "model": self.model,
                    "file": audio_file,
                    "response_format": "verbose_json"
                }
                if language:
                    kwargs["language"] = language

                transcript = await self.client.audio.transcriptions.create(**kwargs)
            
            segments = []
            if hasattr(transcript, "segments") and transcript.segments:
                for seg in transcript.segments:
                    if isinstance(seg, dict):
                        segments.append({
                            "start": seg.get("start"),
                            "end": seg.get("end"),
                            "text": seg.get("text")
                        })
                    else:
                        segments.append({
                            "start": getattr(seg, "start", 0),
                            "end": getattr(seg, "end", 0),
                            "text": getattr(seg, "text", "")
                        })
            
            logger.info(f"OpenAI transcription complete", extra={"audio_path": audio_path, "segments": len(segments)})

            return {
                "text": transcript.text,
                "segments": segments
            }
        except Exception as e:
            logger.error("OpenAI STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"OpenAI STT failed: {str(e)}") from e

    async def get_models(self) -> list:
        try:
            models = await self.client.models.list()
            return [m.id for m in models.data if "whisper" in m.id or "stt" in m.id]
        except Exception as e:
            logger.error(f"Failed to fetch OpenAI models: {e}")
            return ["whisper-1"]
