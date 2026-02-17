import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

class GeminiClient:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
        else:
            logger.warning("GOOGLE_API_KEY is not set")

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = "gemini-pro") -> dict:
        logger.info(f"Calling Gemini API with model {model}")

        try:
            model_instance = genai.GenerativeModel(
                model_name=model,
                system_instruction=system_prompt
            )

            # Gemini response usually needs to be coerced into JSON if not using structured output feature
            # But for simplicity and consistency with OpenAI, we'll ask for JSON in the prompt too.
            response = await model_instance.generate_content_async(
                user_prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json"
                )
            )

            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise
