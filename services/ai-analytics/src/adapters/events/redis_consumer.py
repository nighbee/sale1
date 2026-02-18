import asyncio
import os
import logging
import redis.asyncio as redis
from src.core.usecases.analyze_call import AnalyzeCallUseCase
from src.adapters.storage.postgres_repo import log_processing_event
from src.infrastructure.monitoring.metrics import EVENTS_PROCESSED

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
                        log_processing_event(call_id, "ai-analytics", "processing")

                        try:
                            await use_case.execute(call_id, company_id)
                            log_processing_event(call_id, "ai-analytics", "completed")
                            EVENTS_PROCESSED.labels(status='completed').inc()
                            # Acknowledge message
                            await r.xack(stream_name, group_name, msg_id)
                        except Exception as e:
                            logger.error(f"Failed to analyze call {call_id}: {e}")
                            log_processing_event(call_id, "ai-analytics", "error", error_message=str(e))
                            EVENTS_PROCESSED.labels(status='error').inc()

        except Exception as e:
            logger.error(f"Consumer error: {e}")
            await asyncio.sleep(5)
