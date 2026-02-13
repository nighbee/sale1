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
                    logger.error(f"Failed to execute use case for call {job.get('call_id')}: {e}")

                    retry_count = job.get('retry_count', 0)
                    max_retries = job.get('max_retries', 3)

                    if retry_count < max_retries:
                        job['retry_count'] = retry_count + 1
                        logger.info(f"Retrying call {job.get('call_id')} ({job['retry_count']}/{max_retries})")
                        await r.rpush("bullmq:audio_processing", json.dumps(job))
                    else:
                        logger.error(f"Max retries reached for call {job.get('call_id')}. Marking as error.")
                        # Log error to DB
                        from src.adapters.storage.postgres_repo import get_pool
                        conn = get_pool().getconn()
                        try:
                            cur = conn.cursor()
                            cur.execute("UPDATE calls_schema.calls SET status = 'error' WHERE id = %s", (job.get('call_id'),))
                            cur.execute("""
                                INSERT INTO logs_schema.processing_logs (id, call_id, service_name, status, error_message, retry_count)
                                VALUES (gen_random_uuid(), %s, %s, 'error', %s, %s)
                            """, (job.get('call_id'), 'stt-service', str(e), retry_count))
                            conn.commit()
                        finally:
                            get_pool().putconn(conn)

        except Exception as e:
            logger.error(f"Consumer error: {e}")
            await asyncio.sleep(5)
