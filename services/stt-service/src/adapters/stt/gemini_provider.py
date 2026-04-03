import os
import json
import asyncio
import logging
import google.generativeai as genai
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class GeminiSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None, language: str = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI/GOOGLE_API_KEY is not set")
        else:
            genai.configure(api_key=self.api_key)
        
        self.model_name = model or os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")
        self.model = genai.GenerativeModel(self.model_name)
        self.language = language

    async def transcribe(self, audio_path: str) -> dict:
        if not self.api_key:
            raise RuntimeError("Gemini API key missing")

        try:
            logger.info(f"Transcribing with Gemini: {audio_path}", extra={"model": self.model_name, "language": self.language})

            # Upload file to Gemini File API using a thread to avoid blocking
            sample_file = await asyncio.to_thread(
                genai.upload_file, path=audio_path, display_name="Audio File"
            )

            # Prompt for transcription using the async method
            lang_hint = f" The audio is in {self.language} language." if self.language else ""
            prompt = (
                f"Transcribe this audio file.{lang_hint} "
                "Output strictly valid JSON with the following structure:\n"
                "{\n"
                "  \"text\": \"full transcript text\",\n"
                "  \"segments\": [\n"
                "    {\"start\": 0.0, \"end\": 1.5, \"text\": \"segment text\"}\n"
                "  ]\n"
                "}"
            )

            response = await self.model.generate_content_async(
                [prompt, sample_file],
                generation_config={"response_mime_type": "application/json"}
            )

            # Clean up the file after processing
            try:
                await asyncio.to_thread(genai.delete_file, sample_file.name)
            except Exception:
                pass

            try:
                result = json.loads(response.text)
                text = result.get("text", "")
                segments = result.get("segments", [])
            except (json.JSONDecodeError, AttributeError):
                text = response.text
                segments = []
            
            logger.info(f"Gemini transcription complete", extra={"audio_path": audio_path, "text_length": len(text), "segments": len(segments)})

            return {
                "text": text,
                "segments": segments
            }
        except Exception as e:
            logger.error("Gemini STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"Gemini STT failed: {str(e)}") from e
