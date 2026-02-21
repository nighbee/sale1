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

from typing import Optional
from src.config import Config
from src.logging_setup import setup_logging
from src.pipeline import Pipeline
from src.db import get_active_google_sheets_integrations, get_integration_by_company

setup_logging("sheets-sync", Config.LOG_LEVEL)
logger = logging.getLogger(__name__)

RUN_MODE = os.getenv("RUN_MODE", "scheduler")


def _run_pipeline_cycle(company_id: Optional[str] = None):
    """Run sync for one or all companies."""
    try:
        if company_id:
            integration = get_integration_by_company(Config.DATABASE_URL, company_id)
            integrations = [integration] if integration else []
            if not integration:
                logger.warning("No active google_sheets integration found", extra={"company_id": company_id})
        else:
            integrations = get_active_google_sheets_integrations(Config.DATABASE_URL)

        if not integrations:
            logger.debug("No integrations to sync")
            return

        for integration in integrations:
            cid = str(integration["company_id"])
            config = integration.get("config") or {}
            spreadsheet_id = config.get("spreadsheet_id") or Config.GOOGLE_SHEETS_ID
            sheet_name = config.get("sheet_name") or Config.SHEET_NAME

            if not spreadsheet_id:
                logger.warning("Skipping company: no spreadsheet_id configured", extra={"company_id": cid})
                continue

            try:
                pipeline = Pipeline(
                    company_id=cid,
                    spreadsheet_id=spreadsheet_id,
                    sheet_name=sheet_name
                )
                pipeline.run()
            except Exception as e:
                logger.error("Pipeline failed for company", extra={"company_id": cid, "error": str(e)})

    except Exception as e:
        logger.error("Sync cycle execution failed", extra={"error": str(e)})


# ── Scheduler mode ────────────────────────────────────────────────────────────

def run_scheduler():
    interval = Config.sync_interval_seconds()
    logger.info("Sheets-sync scheduler started", extra={"interval_s": interval})
    while True:
        _run_pipeline_cycle()
        logger.info("Sleeping until next cycle", extra={"sleep_s": interval})
        time.sleep(interval)


# ── API mode ──────────────────────────────────────────────────────────────────

def run_api():
    import threading
    import uvicorn
    from fastapi import FastAPI, BackgroundTasks, Query

    app = FastAPI(title="Sheets Sync Service", version="1.0.0")
    interval = Config.sync_interval_seconds()

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "sheets-sync"}

    @app.post("/sync")
    def trigger_sync(background_tasks: BackgroundTasks, company_id: Optional[str] = Query(None)):
        background_tasks.add_task(_run_pipeline_cycle, company_id)
        return {"status": "accepted", "message": "Sync cycle started", "company_id": company_id}

    @app.post("/sync/blocking")
    def trigger_sync_blocking(company_id: Optional[str] = Query(None)):
        try:
            _run_pipeline_cycle(company_id)
            return {"status": "completed", "company_id": company_id}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _polling_loop():
        logger.info("Background poller started", extra={"interval_s": interval})
        while True:
            time.sleep(interval)
            logger.info("Polling cycle triggered", extra={"interval_s": interval})
            _run_pipeline_cycle()

    # Run one cycle on startup (global)
    _run_pipeline_cycle()

    # Start background polling thread
    t = threading.Thread(target=_polling_loop, daemon=True)
    t.start()

    port = int(os.getenv("PORT", 8085))
    logger.info("Sheets-sync API server starting", extra={"port": port})
    uvicorn.run(app, host="0.0.0.0", port=port, log_config=None)


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if RUN_MODE == "api":
        run_api()
    else:
        run_scheduler()
