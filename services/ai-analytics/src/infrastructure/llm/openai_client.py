import os
import json
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class OpenAIClient:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY not set")
        self.client = AsyncOpenAI(api_key=self.api_key)

    async def analyze(self, system_prompt: str, user_prompt: str, model: str = "gpt-4-turbo-preview") -> dict:
        logger.info(f"Calling OpenAI API with model {model}")

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            raise
