import asyncio
import logging
import os
from prometheus_client import start_http_server
from src.adapters.events.redis_consumer import start_consumer
from src.infrastructure.grpc.server import serve

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting AI Analytics Service...")

    # Start Prometheus metrics server
    metrics_port = int(os.getenv("METRICS_PORT", 8001))
    start_http_server(metrics_port)
    logger.info(f"Prometheus metrics server started on port {metrics_port}")

    # Start gRPC server in background
    grpc_server = serve()
    await start_consumer()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
