import asyncio
import os
import logging
import redis.asyncio as redis
from src.core.usecases.analyze_call import AnalyzeCallUseCase
from src.adapters.storage.postgres_repo import log_processing_event, update_call_status
from src.infrastructure.monitoring.metrics import EVENTS_PROCESSED

logger = logging.getLogger(__name__)

async def start_consumer():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        password = os.getenv("REDIS_PASSWORD")
        host = os.getenv("REDIS_HOST", "redis")
        port = os.getenv("REDIS_PORT", "6379")
        if password:
            redis_url = f"redis://:{password}@{host}:{port}"
        else:
            redis_url = f"redis://{host}:{port}"

    r = await redis.from_url(redis_url)

    use_case = AnalyzeCallUseCase()
    stream_name = "transcript_ready"
    group_name = "ai_analytics_group"
    consumer_name = "ai_analytics_consumer_1"

    logger.info("AI Analytics consumer started",
                extra={"stream": stream_name, "group": group_name, "consumer": consumer_name})

    while True:
        try:
            # Attempt to ensure the consumer group exists before reading
            try:
                await r.xgroup_create(stream_name, group_name, id="0", mkstream=True)
                logger.info("Redis consumer group created",
                            extra={"stream": stream_name, "group": group_name})
            except Exception as e:
                # Catch "BUSYGROUP Consumer Group name already exists" or other errors
                if "BUSYGROUP" not in str(e):
                    logger.debug(f"Note: Consumer group creation skipped or failed: {e}")

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
                            update_call_status(call_id, "error")
                            EVENTS_PROCESSED.labels(status='error').inc()

        except Exception as e:
            logger.error("AI Analytics consumer loop error", extra={"error": str(e)})
            await asyncio.sleep(5)
