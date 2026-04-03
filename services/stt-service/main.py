import asyncio
import logging
import os
import uvicorn
from fastapi import FastAPI, Body, HTTPException
from prometheus_client import make_asgi_app
from src.infrastructure.logging.json_logger import setup_logging
from src.core.usecases.check_model import CheckModelUseCase
from src.adapters.queue.bullmq_consumer import start_consumer
from src.infrastructure.grpc.server import serve
from src.infrastructure.monitoring.metrics import APP_INFO

setup_logging("stt-service")
logger = logging.getLogger(__name__)

app = FastAPI(title="STT Service Metrics & Health")
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "stt-service"}

@app.post("/api/v1/check-model")
async def check_model(
    provider_name: str = Body(...),
    credentials: dict = Body(None),
    model: str = Body(None)
):
    use_case = CheckModelUseCase()
    result = await use_case.execute(provider_name, credentials, model)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@app.post("/api/v1/models")
async def get_models(
    provider_name: str = Body(...),
    credentials: dict = Body(None)
):
    try:
        # Mock integration list for factory
        integrations = []
        if credentials:
            integrations.append({
                "integration_type": provider_name,
                "credentials": credentials
            })

        from src.adapters.stt.factory import STTProviderFactory
        provider = STTProviderFactory.create(provider_name, integrations)
        models = await provider.get_models()
        return {"models": models}
    except Exception as e:
        logger.error(f"Failed to fetch models for {provider_name}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

async def run_http_server():
    metrics_port = int(os.getenv("METRICS_PORT", 8001))
    config = uvicorn.Config(app, host="0.0.0.0", port=metrics_port, log_config=None)
    server = uvicorn.Server(config)
    logger.info("HTTP metrics & health server starting", extra={"port": metrics_port})
    await server.serve()

async def main():
    logger.info("STT service starting")

    APP_INFO.labels(app_name="stt-service").set(1)

    grpc_server = serve()

    await asyncio.gather(
        run_http_server(),
        start_consumer()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("STT service stopped by user")
