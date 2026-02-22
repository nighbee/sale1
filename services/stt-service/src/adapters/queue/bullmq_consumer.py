import asyncio
import json
import redis.asyncio as redis
import logging
import os
import time
from src.core.usecases.process_audio import ProcessAudioUseCase
from src.adapters.storage.postgres_repo import log_processing_event
from src.infrastructure.monitoring.metrics import JOBS_PROCESSED

logger = logging.getLogger(__name__)

async def start_consumer():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    use_case = ProcessAudioUseCase()

    logger.info("STT BullMQ consumer started", extra={"queue": "bullmq:audio_processing", "redis_url": redis_url})

    while True:
        try:
            result = await r.blpop("bullmq:audio_processing", timeout=5)

            if result:
                _, job_data = result
                job = json.loads(job_data)

                call_id = job.get('call_id')
                retry_count = job.get('retry_count', 0)
                max_retries = job.get('max_retries', 3)

                audio_url = job.get('audio_url') or job.get('call_link', '<not set>')
                logger.info(
                    "Job received from BullMQ",
                    extra={
                        "call_id": call_id,
                        "queue": "bullmq:audio_processing",
                        "audio_url": audio_url,
                        "attempt": retry_count + 1,
                        "max_retries": max_retries,
                    },
                )
                log_processing_event(call_id, "stt-service", "processing", retry_count=retry_count)

                t_start = time.monotonic()
                try:
                    logger.info("STT processing started", extra={"call_id": call_id})
                    await use_case.execute(job)
                    elapsed = round(time.monotonic() - t_start, 2)
                    log_processing_event(call_id, "stt-service", "completed", retry_count=retry_count)
                    JOBS_PROCESSED.labels(status='completed').inc()
                    logger.info(
                        "STT job completed successfully",
                        extra={"call_id": call_id,
                               "attempt": retry_count + 1, "elapsed_s": elapsed},
                    )
                except Exception as e:
                    JOBS_PROCESSED.labels(status='error').inc()
                    log_processing_event(call_id, "stt-service", "error", error_message=str(e), retry_count=retry_count)

                    if retry_count < max_retries:
                        next_attempt = retry_count + 1
                        backoff = 5 * (retry_count + 1)
                        job['retry_count'] = next_attempt
                        logger.warning(
                            "STT job failed, retrying",
                            extra={"call_id": call_id, "attempt": next_attempt,
                                   "backoff_s": backoff, "error": str(e)},
                        )
                        await asyncio.sleep(backoff)
                        await r.rpush("bullmq:audio_processing", json.dumps(job))
                    else:
                        logger.error(
                            "STT job max retries reached",
                            extra={"call_id": call_id, "max_retries": max_retries, "error": str(e)},
                        )

        except Exception as e:
            logger.error("BullMQ consumer loop error", extra={"error": str(e)})
            await asyncio.sleep(5)
