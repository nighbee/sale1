import asyncio
import json
import redis.asyncio as redis
import requests
import os
from src.adapters.storage.postgres_repo import save_transcript
from src.adapters.events.redis_publisher import publish_transcript_ready

async def start_consumer():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    print("STT Consumer started, waiting for jobs...")

    while True:
        try:
            result = await r.blpop("bullmq:audio_processing", timeout=5)

            if result:
                _, job_data = result
                job = json.loads(job_data)

                print(f"Processing call: {job['call_id']}")

                stt_local_url = os.getenv("LOCAL_STT_URL", "http://stt-local:5001")
                try:
                    resp = requests.post(f"{stt_local_url}/transcribe", data={"url": job["audio_url"]}, timeout=300)
                    resp.raise_for_status()
                    transcript = resp.json()
                    print(f"Transcription successful for {job['call_id']}")

                    # Save to DB
                    save_transcript(job["call_id"], transcript, "whisper-local")

                    # Publish event
                    publish_transcript_ready(job["call_id"], job["company_id"])

                    print(f"Transcript saved and event published for {job['call_id']}")
                except Exception as e:
                    print(f"STT Local error: {e}")

        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(start_consumer())
