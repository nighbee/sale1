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
        logger.info("Redis consumer group created",
                    extra={"stream": stream_name, "group": group_name})
    except Exception:
        logger.debug("Redis consumer group already exists",
                     extra={"stream": stream_name, "group": group_name})

    logger.info("AI Analytics consumer started",
                extra={"stream": stream_name, "group": group_name, "consumer": consumer_name})

    while True:
        try:
            messages = await r.xreadgroup(group_name, consumer_name, {stream_name: ">"}, count=1, block=5000)

            if messages:
                for stream, msg_list in messages:
                    for msg_id, payload in msg_list:
                        call_id = payload.get(b'call_id').decode('utf-8')
                        event_type = payload.get(b'event_type', b'').decode('utf-8')

                        logger.info(
                            "Event received from Redis stream",
                            extra={
                                "call_id": call_id,
                                "stream": stream_name,
                                "event_type": event_type,
                                "msg_id": msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id),
                            },
                        )
                        log_processing_event(call_id, "ai-analytics", "processing")

                        try:
                            logger.info("AI analysis started", extra={"call_id": call_id})
                            await use_case.execute(call_id)
                            log_processing_event(call_id, "ai-analytics", "completed")
                            EVENTS_PROCESSED.labels(status='completed').inc()
                            await r.xack(stream_name, group_name, msg_id)
                            logger.info("AI analysis completed successfully",
                                        extra={"call_id": call_id})
                        except Exception as e:
                            logger.error("AI analysis failed",
                                         extra={"call_id": call_id,
                                                "error": str(e)})
                            log_processing_event(call_id, "ai-analytics", "error", error_message=str(e))
                            EVENTS_PROCESSED.labels(status='error').inc()

        except Exception as e:
            logger.error("AI Analytics consumer loop error", extra={"error": str(e)})
            await asyncio.sleep(5)
