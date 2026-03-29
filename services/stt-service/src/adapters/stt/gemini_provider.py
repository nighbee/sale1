import os
import asyncio
import google.generativeai as genai
from src.core.ports.stt_provider import STTProvider

class GeminiSTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY is not set")
        genai.configure(api_key=self.api_key)
        
        model_name = os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")
        self.model = genai.GenerativeModel(model_name)

    async def transcribe(self, audio_path: str) -> dict:
        try:
            # Upload file to Gemini File API using a thread to avoid blocking
            sample_file = await asyncio.to_thread(
                genai.upload_file, path=audio_path, display_name="Audio File"
            )

            # Prompt for transcription using the async method
            response = await self.model.generate_content_async([
                "Transcribe this audio file strictly. Output JSON with 'text' and 'segments' (if possible, otherwise just text).",
                sample_file
            ])

            # Clean up the file after processing
            try:
                await asyncio.to_thread(genai.delete_file, sample_file.name)
            except Exception:
                pass

            # Gemini might not return structured segments easily without strictly engineered prompt or JSON mode.
            # For now, we'll return the text. Segments might be empty.
            # In a real production implementation, we would force JSON structure.
            
            text = response.text
            
            return {
                "text": text,
                "segments": [] # Gemini audio transcription simple mode doesn't give timestamps easily without specific prompting
            }
        except Exception as e:
             raise Exception(f"Gemini STT failed: {str(e)}")
