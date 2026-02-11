import redis
import json
import os

def publish_transcript_ready(call_id, company_id):
    r = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))
    event = {
        "event_type": "transcript_ready",
        "call_id": call_id,
        "company_id": company_id
    }
    r.xadd("transcript_ready", event)
