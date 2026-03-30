import asyncio
import logging
import os
from src.infrastructure.llm.gemini_client import GeminiClient
from src.infrastructure.prompts.system_prompts import SYSTEM_PROMPT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_gemini_analytics():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment")
        return

    client = GeminiClient(api_key=api_key, model="gemini-3-flash-preview")
    
    sample_transcript = "[Manager]: Здравствуйте! Чем я могу вам помочь?\n[Client]: Здравствуйте, я ищу промышленное оборудование.\n[Manager]: Отлично, у нас есть широкий выбор."
    sample_script = "1. Приветствие. 2. Выяснение потребностей. 3. Предложение решения."
    
    user_prompt = f"TRANSCRIPT:\n{sample_transcript}\n\nSCRIPT:\n{sample_script}"
    
    try:
        logger.info("Starting Gemini analytics test...")
        result = await client.analyze(SYSTEM_PROMPT, user_prompt)
        
        logger.info("Analysis successful!")
        import json
        logger.info(f"Result: {json.dumps(result, indent=2, ensure_ascii=False)}")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini_analytics())
