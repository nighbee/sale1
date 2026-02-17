import os
from openai import AsyncOpenAI
from src.core.ports.stt_provider import STTProvider

class OpenAISTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        self.client = AsyncOpenAI(api_key=self.api_key)

    async def transcribe(self, audio_path: str) -> dict:
        try:
            with open(audio_path, "rb") as audio_file:
                transcript = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json"
                )
            
            # Map OpenAI response to our internal format
            segments = []
            if hasattr(transcript, 'segments'):
                for seg in transcript.segments:
                    segments.append({
                        "start": seg['start'],
                        "end": seg['end'],
                        "text": seg['text']
                    })
            
            return {
                "text": transcript.text,
                "segments": segments
            }
        except Exception as e:
            raise Exception(f"OpenAI STT failed: {str(e)}")
