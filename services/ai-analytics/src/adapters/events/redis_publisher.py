import os
import redis.asyncio as redis
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

async def publish_analysis_completed(call_id, overall_rating):
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

    event = {
        "event_type": "analysis_completed",
        "call_id": call_id,
        "overall_rating": float(overall_rating),
        "timestamp": datetime.now().isoformat()
    }

    try:
        await r.xadd("analysis_completed", {"payload": json.dumps(event)})
        logger.info("published analysis_completed event",
                    extra={"call_id": call_id, "overall_rating": overall_rating,
                           "stream": "analysis_completed"})
    except Exception as e:
        logger.error("failed to publish analysis_completed",
                     extra={"call_id": call_id, "error": str(e)})
    finally:
        await r.close()

async def publish_critical_error(call_id, error_type, message):
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

    event = {
        "event_type": "critical_error",
        "call_id": call_id,
        "error_type": error_type,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }

    try:
        await r.xadd("critical_error", {"payload": json.dumps(event)})
        logger.warning("published critical_error event",
                       extra={"call_id": call_id,
                              "error_type": error_type, "stream": "critical_error"})
    except Exception as e:
        logger.error("failed to publish critical_error",
                     extra={"call_id": call_id, "error": str(e)})
    finally:
        await r.close()
