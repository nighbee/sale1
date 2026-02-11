import asyncio
import logging
from src.adapters.queue.bullmq_consumer import start_consumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting STT Service...")
    await start_consumer()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
