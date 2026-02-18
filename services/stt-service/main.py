import asyncio
import logging
from src.adapters.queue.bullmq_consumer import start_consumer
from src.infrastructure.grpc.server import serve

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting STT Service...")
    # Start gRPC server in background
    grpc_server = serve()
    await start_consumer()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
