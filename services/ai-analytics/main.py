import asyncio
from src.adapters.events.redis_consumer import start_consumer

if __name__ == "__main__":
    asyncio.run(start_consumer())
