import asyncio
import json
import redis.asyncio as redis
import logging
import os
from src.core.usecases.process_audio import ProcessAudioUseCase
from src.adapters.storage.postgres_repo import log_processing_event

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

                call_id = job.get('call_id')
                retry_count = job.get('retry_count', 0)
                max_retries = job.get('max_retries', 3)

                logger.info(f"Processing job for call: {call_id} (Attempt {retry_count + 1})")
                log_processing_event(call_id, "stt-service", "processing", retry_count=retry_count)

                try:
                    await use_case.execute(job)
                    log_processing_event(call_id, "stt-service", "completed", retry_count=retry_count)
                except Exception as e:
                    logger.error(f"Failed to execute use case: {e}")

                    log_processing_event(call_id, "stt-service", "error", error_message=str(e), retry_count=retry_count)
                    if retry_count < max_retries:
                        job['retry_count'] = retry_count + 1
                        logger.info(f"Retrying job for call: {call_id}. New attempt: {job['retry_count']}")
                        # Wait a bit before retrying (exponential backoff mock)
                        await asyncio.sleep(5 * (retry_count + 1))
                        await r.rpush("bullmq:audio_processing", json.dumps(job))
                    else:
                        logger.error(f"Max retries reached for call: {call_id}")

        except Exception as e:
            logger.error(f"Consumer error: {e}")
            await asyncio.sleep(5)
