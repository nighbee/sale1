import os
import redis.asyncio as redis
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

async def publish_analysis_completed(call_id, overall_rating):
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    event = {
        "event_type": "analysis_completed",
        "call_id": call_id,
        "overall_rating": float(overall_rating),
        "timestamp": datetime.now().isoformat()
    }

    try:
        await r.xadd("analysis_completed", {"payload": json.dumps(event)})
        logger.info(f"Published analysis_completed for call {call_id}")
    except Exception as e:
        logger.error(f"Failed to publish analysis_completed: {e}")
    finally:
        await r.close()

async def publish_critical_error(call_id, company_id, error_type, message):
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    event = {
        "event_type": "critical_error",
        "call_id": call_id,
        "company_id": company_id,
        "error_type": error_type,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }

    try:
        await r.xadd("critical_error", {"payload": json.dumps(event)})
        logger.info(f"Published critical_error for call {call_id}")
    except Exception as e:
        logger.error(f"Failed to publish critical_error: {e}")
    finally:
        await r.close()
