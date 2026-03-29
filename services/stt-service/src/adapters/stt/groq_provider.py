import os
import asyncio
from openai import AsyncOpenAI
from src.core.ports.stt_provider import STTProvider


class GroqSTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not set")
        # Groq exposes an OpenAI-compatible API — same SDK, different base_url
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")

    async def transcribe(self, audio_path: str) -> dict:
        try:
            # Move synchronous file reading to a thread
            audio_buffer = await asyncio.to_thread(self._read_file, audio_path)

            transcript = await self.client.audio.transcriptions.create(
                model=self.model,
                file=("audio.mp3", audio_buffer),
                # If audio_path is used as a path, AsyncOpenAI might try to open it synchronously.
                # Passing the buffer directly ensures we control the I/O.
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

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

            return {
                "text": transcript.text,
                "segments": segments,
            }
        except Exception as e:
            raise Exception(f"Groq STT failed: {str(e)}")

    def _read_file(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()
