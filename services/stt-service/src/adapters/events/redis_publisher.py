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
    await r.xadd("transcript_ready", event)
    await r.close()
    logger.info(f"Published transcript_ready event for call {call_id}")
