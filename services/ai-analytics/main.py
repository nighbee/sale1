import asyncio
import logging
import os
from prometheus_client import start_http_server
from src.infrastructure.logging.json_logger import setup_logging
from src.adapters.events.redis_consumer import start_consumer
from src.infrastructure.grpc.server import serve

setup_logging("ai-analytics")
logger = logging.getLogger(__name__)

async def main():
    logger.info("AI Analytics service starting")

    metrics_port = int(os.getenv("METRICS_PORT", 8001))
    start_http_server(metrics_port)
    logger.info("Prometheus metrics server started", extra={"metrics_port": metrics_port})

    grpc_server = serve()
    await start_consumer()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("AI Analytics service stopped by user")
