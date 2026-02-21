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

    app = FastAPI(title="Sheets Sync Service", version="1.0.0")
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
            _run_pipeline(pipeline)

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
    try:
        pipeline.run()
    except Exception as e:
        logger.error("Background sync cycle failed", extra={"error": str(e)})


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if RUN_MODE == "api":
        run_api()
    else:
        run_scheduler()
