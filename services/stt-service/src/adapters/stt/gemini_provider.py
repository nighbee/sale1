import os
import asyncio
import logging
import google.generativeai as genai
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class GeminiSTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI/GOOGLE_API_KEY is not set")
        else:
            genai.configure(api_key=self.api_key)
        
        model_name = os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")
        self.model = genai.GenerativeModel(model_name)

    async def transcribe(self, audio_path: str) -> dict:
        if not self.api_key:
            raise RuntimeError("Gemini API key missing")

        try:
            logger.info(f"Transcribing with Gemini: {audio_path}")

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

            text = response.text
            
            logger.info(f"Gemini transcription complete", extra={"audio_path": audio_path, "text_length": len(text)})

            return {
                "text": text,
                "segments": []
            }
        except Exception as e:
            logger.error("Gemini STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"Gemini STT failed: {str(e)}") from e
