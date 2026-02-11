import asyncio
import os
import redis.asyncio as redis
from src.core.usecases.analyze_call import AnalyzeCallUseCase

async def start_consumer():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    r = await redis.from_url(redis_url)

    print("AI Analytics Consumer started, waiting for transcript events...")

    try:
        await r.xgroup_create("transcript_ready", "analytics_group", id="0", mkstream=True)
    except:
        pass

    while True:
        try:
            results = await r.xreadgroup("analytics_group", "consumer1", {"transcript_ready": ">"}, count=1, block=5000)

            if results:
                for stream, messages in results:
                    for msg_id, payload in messages:
                        call_id = payload[b'call_id'].decode()
                        company_id = payload[b'company_id'].decode()
                        print(f"Received transcript for call: {call_id} (Company: {company_id})")

                        use_case = AnalyzeCallUseCase()
                        await use_case.execute(call_id, company_id)

                        await r.xack("transcript_ready", "analytics_group", msg_id)

        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(start_consumer())
