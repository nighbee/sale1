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
            if hasattr(transcript, "segments") and transcript.segments:
                for seg in transcript.segments:
                    # Handle both object and dict (some providers/SDK versions vary)
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
            
            return {
                "text": transcript.text,
                "segments": segments
            }
        except Exception as e:
            raise Exception(f"OpenAI STT failed: {str(e)}")
