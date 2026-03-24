"""
sheets-sync service entry point.

Modes (controlled via RUN_MODE env var):
  scheduler  (default) – run the pipeline on a cron loop (SYNC_INTERVAL)
  api                  – expose a FastAPI HTTP server with a POST /sync endpoint

Both modes always run one immediate sync cycle on startup.
"""

import asyncio
import logging
import os
import time
import traceback

from dotenv import load_dotenv

load_dotenv()

from src.config import Config
from src.logging_setup import setup_logging
from src.pipeline import Pipeline

setup_logging("sheets-sync", Config.LOG_LEVEL)
logger = logging.getLogger(__name__)

RUN_MODE = os.getenv("RUN_MODE", "scheduler")


# ── Scheduler mode ────────────────────────────────────────────────────────────

def run_scheduler():
    pipeline = Pipeline()
    interval = Config.sync_interval_seconds()
    logger.info("Sheets-sync scheduler started", extra={"interval_s": interval})
    while True:
        try:
            pipeline.run()
        except Exception as e:
            logger.error("Sync cycle failed", extra={"error": str(e)})
        logger.info("Sleeping until next cycle", extra={"sleep_s": interval})
        time.sleep(interval)


# ── API mode ──────────────────────────────────────────────────────────────────

def run_api():
    import threading
    import uvicorn
    from fastapi import FastAPI, BackgroundTasks
    from prometheus_client import make_asgi_app

    app = FastAPI(title="Sheets Sync Service", version="1.0.0")
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
    pipeline = Pipeline()
    interval = Config.sync_interval_seconds()

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "sheets-sync"}

    @app.post("/sync")
    def trigger_sync(background_tasks: BackgroundTasks):
        background_tasks.add_task(_run_pipeline, pipeline)
        return {"status": "accepted", "message": "Sync cycle started"}

    @app.post("/sync/blocking")
    def trigger_sync_blocking():
        try:
            pipeline.run()
            return {"status": "completed"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _polling_loop():
        logger.info("Background poller started", extra={"interval_s": interval})
        while True:
            time.sleep(interval)
            logger.info("Polling cycle triggered", extra={"interval_s": interval})
            _run_pipeline_with_retry(pipeline)

    # Run one cycle on startup
    try:
        pipeline.run()
    except Exception as e:
        logger.error("Initial sync failed", extra={"error": str(e)})

    # Start background polling thread
    t = threading.Thread(target=_polling_loop, daemon=True)
    t.start()

    port = int(os.getenv("PORT", 8085))
    logger.info("Sheets-sync API server starting", extra={"port": port})
    uvicorn.run(app, host="0.0.0.0", port=port, log_config=None)


def _run_pipeline(pipeline: Pipeline):
    logger.info("Starting pipeline._run_pipeline", extra={"caller": "_run_pipeline"})
    start_t = time.perf_counter()
    try:
        pipeline.run()
        duration = time.perf_counter() - start_t
        logger.info("pipeline._run_pipeline completed", extra={"duration_s": duration})
    except Exception:
        duration = time.perf_counter() - start_t
        logger.exception("pipeline._run_pipeline failed", extra={"duration_s": duration, "trace": traceback.format_exc()})


def _run_pipeline_with_retry(pipeline: Pipeline, max_retries: int = 3, base_delay: float = 1.0):
    """Run pipeline with exponential backoff retry for transient errors."""
    for attempt in range(max_retries):
        try:
            _run_pipeline(pipeline)
            return  # Success, exit retry loop
        except Exception as e:
            error_type = type(e).__name__
            is_retryable = _is_retryable_error(e)
            
            if attempt < max_retries - 1 and is_retryable:
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(
                    "Pipeline failed, retrying",
                    extra={
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "error_type": error_type,
                        "error": str(e),
                        "delay_s": delay,
                    },
                )
                time.sleep(delay)
            else:
                logger.error(
                    "Pipeline failed after all retries",
                    extra={
                        "attempt": attempt + 1,
                        "error_type": error_type,
                        "error": str(e),
                    },
                )
                return  # Exit after all retries failed


def _is_retryable_error(exception: Exception) -> bool:
    """Determine if an error is transient and worth retrying."""
    error_str = str(exception).lower()
    retryable_patterns = [
        "ssl",
        "timeout",
        "connection",
        "reset",
        "temporary",
        "unavailable",
        "429",  # Rate limiting
        "500",  # Internal server error
        "502",  # Bad gateway
        "503",  # Service unavailable
        "504",  # Gateway timeout
    ]
    return any(pattern in error_str for pattern in retryable_patterns)


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if RUN_MODE == "api":
        run_api()
    else:
        run_scheduler()
