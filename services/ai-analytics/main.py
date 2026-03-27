import asyncio
import logging
import os
import uvicorn
from fastapi import FastAPI
from prometheus_client import make_asgi_app
from src.infrastructure.logging.json_logger import setup_logging
from src.adapters.events.redis_consumer import start_consumer
from src.infrastructure.grpc.server import serve
from src.infrastructure.monitoring.metrics import APP_INFO

setup_logging("ai-analytics")
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Analytics Service Metrics & Health")
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-analytics"}

async def run_http_server():
    metrics_port = int(os.getenv("METRICS_PORT", 8001))
    config = uvicorn.Config(app, host="0.0.0.0", port=metrics_port, log_config=None)
    server = uvicorn.Server(config)
    logger.info("HTTP metrics & health server starting", extra={"port": metrics_port})
    await server.serve()

async def main():
    logger.info("AI Analytics service starting")

    APP_INFO.labels(app_name="ai-analytics").set(1)

    grpc_server = serve()

    await asyncio.gather(
        run_http_server(),
        start_consumer()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("AI Analytics service stopped by user")
