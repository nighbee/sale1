import os
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
            with open(audio_path, "rb") as audio_file:
                transcript = await self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )

            segments = []
            if hasattr(transcript, "segments") and transcript.segments:
                for seg in transcript.segments:
                    segments.append({
                        "start": seg["start"],
                        "end": seg["end"],
                        "text": seg["text"],
                    })

            return {
                "text": transcript.text,
                "segments": segments,
            }
        except Exception as e:
            raise Exception(f"Groq STT failed: {str(e)}")
