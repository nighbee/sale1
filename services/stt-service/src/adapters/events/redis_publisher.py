import redis.asyncio as redis
import json
import os
import logging

logger = logging.getLogger(__name__)

async def publish_transcript_ready(call_id, company_id):
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)
    event = {
        "event_type": "transcript_ready",
        "call_id": call_id,
        "company_id": company_id
    }
    # Redis Streams use xadd
    msg_id = await r.xadd("transcript_ready", event)
    await r.close()
    logger.info(
        "published transcript_ready event",
        extra={
            "call_id": call_id,
            "company_id": company_id,
            "stream": "transcript_ready",
            "msg_id": msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id),
            "payload": event,
        },
    )
