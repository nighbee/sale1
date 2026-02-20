"""
Push jobs onto the BullMQ-compatible Redis list.
The STT service pops from `bullmq:audio_processing`.
"""

import json
import logging

import redis

logger = logging.getLogger(__name__)


class QueueClient:
    def __init__(self, redis_url: str, queue_name: str):
        self._r = redis.from_url(redis_url, decode_responses=True)
        self._queue = queue_name
        logger.info("QueueClient ready", extra={"queue": queue_name})

    def push_job(self, call_id: str, company_id: str, call_link: str, chat_link: str = ""):
        job = {
            "call_id": call_id,
            "company_id": company_id,
            "audio_url": call_link,
            "chat_link": chat_link,
            "retry_count": 0,
            "max_retries": 3,
        }
        self._r.rpush(self._queue, json.dumps(job))
        logger.info(
            "Job queued",
            extra={
                "call_id": call_id,
                "company_id": company_id,
                "queue": self._queue,
                "call_link": call_link,
                "chat_link": chat_link or '—',
            },
        )
