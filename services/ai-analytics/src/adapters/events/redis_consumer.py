import asyncio
import os
import logging
import redis.asyncio as redis
from src.core.usecases.analyze_call import AnalyzeCallUseCase

logger = logging.getLogger(__name__)

async def start_consumer():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    use_case = AnalyzeCallUseCase()
    stream_name = "transcript_ready"
    group_name = "ai_analytics_group"
    consumer_name = "ai_analytics_consumer_1"

    # Create consumer group if not exists
    try:
        await r.xgroup_create(stream_name, group_name, id="0", mkstream=True)
    except Exception as e:
        # Group already exists
        pass

    logger.info(f"AI Analytics Consumer started, listening to stream '{stream_name}'...")

    while True:
        try:
            # Read from stream
            messages = await r.xreadgroup(group_name, consumer_name, {stream_name: ">"}, count=1, block=5000)

            if messages:
                for stream, msg_list in messages:
                    for msg_id, payload in msg_list:
                        call_id = payload.get(b'call_id').decode('utf-8')
                        company_id = payload.get(b'company_id').decode('utf-8')

                        logger.info(f"Received transcript_ready for call: {call_id}")

                        try:
                            await use_case.execute(call_id, company_id)
                            # Acknowledge message
                            await r.xack(stream_name, group_name, msg_id)
                        except Exception as e:
                            logger.error(f"Failed to analyze call {call_id}: {e}")

                            retry_count = int(payload.get(b'retry_count', b'0').decode('utf-8'))
                            max_retries = 3

                            if retry_count < max_retries:
                                logger.info(f"Retrying analysis for call {call_id} ({retry_count + 1}/{max_retries})")
                                await r.xadd(stream_name, {
                                    "call_id": call_id,
                                    "company_id": company_id,
                                    "retry_count": str(retry_count + 1)
                                })
                                await r.xack(stream_name, group_name, msg_id)
                            else:
                                logger.error(f"Max retries reached for analysis of call {call_id}. Marking as error.")
                                from src.adapters.storage.postgres_repo import get_pool
                                conn = get_pool().getconn()
                                try:
                                    cur = conn.cursor()
                                    cur.execute("UPDATE calls_schema.calls SET status = 'error' WHERE id = %s", (call_id,))
                                    cur.execute("""
                                        INSERT INTO logs_schema.processing_logs (id, call_id, service_name, status, error_message, retry_count)
                                        VALUES (gen_random_uuid(), %s, %s, 'error', %s, %s)
                                    """, (call_id, 'ai-analytics', str(e), retry_count))
                                    conn.commit()
                                    await r.xack(stream_name, group_name, msg_id)
                                finally:
                                    get_pool().putconn(conn)

        except Exception as e:
            logger.error(f"Consumer error: {e}")
            await asyncio.sleep(5)
