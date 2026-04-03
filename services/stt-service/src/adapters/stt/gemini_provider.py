import os
import json
import asyncio
import logging
from typing import Optional
import google.generativeai as genai
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class GeminiSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI/GOOGLE_API_KEY is not set")
        else:
            genai.configure(api_key=self.api_key)
        
        self.model_name = model or os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")
        self.model = genai.GenerativeModel(self.model_name)

    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        if not self.api_key:
            raise RuntimeError("Gemini API key missing")

        try:
            logger.info(f"Transcribing with Gemini: {audio_path}", extra={"language": language})

            # Upload file to Gemini File API using a thread to avoid blocking
            sample_file = await asyncio.to_thread(
                genai.upload_file, path=audio_path, display_name="Audio File"
            )

            # Prompt for transcription using the async method
            prompt = (
                f"Transcribe this audio file. Language hint: {language or 'auto'}. "
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

    async def get_models(self) -> list:
        try:
            models = await asyncio.to_thread(genai.list_models)
            return [m.name.replace("models/", "") for m in models if "generateContent" in m.supported_generation_methods]
        except Exception as e:
            logger.error(f"Failed to fetch Gemini models: {e}")
            return ["gemini-1.5-flash", "gemini-1.5-pro"]
