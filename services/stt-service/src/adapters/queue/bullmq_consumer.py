import asyncio
import json
import redis.asyncio as redis
import logging
import os
from src.core.usecases.process_audio import ProcessAudioUseCase

logger = logging.getLogger(__name__)

async def start_consumer():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    use_case = ProcessAudioUseCase()

    logger.info("STT Consumer started, waiting for jobs in 'bullmq:audio_processing'...")

    while True:
        try:
            result = await r.blpop("bullmq:audio_processing", timeout=5)

            if result:
                _, job_data = result
                job = json.loads(job_data)

                logger.info(f"Processing job for call: {job.get('call_id')}")

                try:
                    await use_case.execute(job)
                except Exception as e:
                    logger.error(f"Failed to execute use case: {e}")

        except Exception as e:
            logger.error(f"Consumer error: {e}")
            await asyncio.sleep(5)
