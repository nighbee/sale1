import os
import json
import logging
import re
from openai import AsyncOpenAI, BadRequestError

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

    def _supports_json_mode(self, model: str) -> bool:
        """
        Returns True if the model is known to support JSON mode (response_format={'type': 'json_object'}).
        See: https://platform.openai.com/docs/guides/text-generation/json-mode
        """
        # Whitelist of models known to support JSON mode
        json_models = [
            "gpt-4-turbo",
            "gpt-4-turbo-preview",
            "gpt-4-1106-preview",
            "gpt-3.5-turbo-1106",
            "gpt-3.5-turbo-0125",
            "gpt-4o",
            "gpt-4o-mini"
        ]
        return any(m in model for m in json_models)

    def _extract_json(self, content: str) -> dict:
        """
        Robustly extract JSON from a string that might be wrapped in markdown or contain text.
        """
        content = content.strip()
        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block in markdown
        match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find first { and last }
        match = re.search(r'(\{.*\})', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Final attempt: direct parse of what's left
        return json.loads(content)

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        model = model or self.default_model
        logger.info("sending request to OpenAI-compatible API",
                    extra={"model": model,
                           "base_url": self.base_url or "openai-default",
                           "system_prompt_chars": len(system_prompt),
                           "user_prompt_chars": len(user_prompt)})

        kwargs = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }

        # Only add JSON mode if supported by model
        use_json_mode = self._supports_json_mode(model)
        if use_json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            try:
                response = await self.client.chat.completions.create(**kwargs)
            except BadRequestError as e:
                # If we tried with JSON mode and it failed with a "not supported" error, retry without it
                if use_json_mode and "response_format" in str(e) and "json_object" in str(e):
                    logger.warning("Model reported no support for json_object, retrying without it",
                                   extra={"model": model, "error": str(e)})
                    kwargs.pop("response_format", None)
                    response = await self.client.chat.completions.create(**kwargs)
                else:
                    raise

            content = response.choices[0].message.content
            usage = response.usage
            result = self._extract_json(content)
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
