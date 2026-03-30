import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

class GeminiClient:
    def __init__(self, api_key: str = None, model: str = "gemini-3-flash-preview"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
        else:
            logger.warning("Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set")
        self.default_model = model

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        model = model or self.default_model
        logger.info("sending request to Gemini",
                    extra={"model": model,
                           "system_prompt_chars": len(system_prompt),
                           "user_prompt_chars": len(user_prompt)})

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

            result = json.loads(response.text)
            usage = getattr(response, 'usage_metadata', None)
            logger.info(
                "Gemini response received",
                extra={
                    "model": model,
                    "prompt_token_count": getattr(usage, 'prompt_token_count', None) if usage else None,
                    "candidates_token_count": getattr(usage, 'candidates_token_count', None) if usage else None,
                    "total_token_count": getattr(usage, 'total_token_count', None) if usage else None,
                    "response_fields": list(result.keys()),
                },
            )
            return result
        except Exception as e:
            logger.error("Gemini API call failed", extra={"model": model, "error": str(e)})
            raise
