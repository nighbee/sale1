import os
import json
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class OpenAIClient:
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        # Priority order for API key:
        #   1. explicit api_key passed in
        #   2. LLM_API_KEY  (generic, set per-provider in docker-compose)
        #   3. OPENAI_API_KEY
        self.api_key = (
            api_key
            or os.getenv("LLM_API_KEY")
            or os.getenv("OPENAI_API_KEY")
        )
        self.base_url = base_url or os.getenv("LLM_BASE_URL")  # None → default OpenAI endpoint
        self.default_model = model or os.getenv("LLM_MODEL") or "gpt-4-turbo-preview"

        if not self.api_key:
            logger.warning("Neither LLM_API_KEY nor OPENAI_API_KEY is set")

        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url

        self.client = AsyncOpenAI(**client_kwargs)
        logger.info(
            "LLM client initialised",
            extra={"base_url": self.base_url or "openai-default", "model": self.default_model},
        )

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        model = model or self.default_model
        logger.info("sending request to OpenAI-compatible API",
                    extra={"model": model,
                           "base_url": self.base_url or "openai-default",
                           "system_prompt_chars": len(system_prompt),
                           "user_prompt_chars": len(user_prompt)})

        try:
            # Re-initialize client if api_key has changed (handled outside this class usually)
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            usage = response.usage
            result = json.loads(content)
            logger.info(
                "LLM response received",
                extra={
                    "model": model,
                    "base_url": self.base_url or "openai-default",
                    "prompt_tokens": usage.prompt_tokens if usage else None,
                    "completion_tokens": usage.completion_tokens if usage else None,
                    "total_tokens": usage.total_tokens if usage else None,
                    "response_fields": list(result.keys()),
                },
            )
            return result
        except Exception as e:
            logger.error("LLM API call failed",
                         extra={"model": model, "base_url": self.base_url or "openai-default", "error": str(e)})
            raise

