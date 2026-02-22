"""
Main sync pipeline.

Cycle (runs every SYNC_INTERVAL seconds):

  1. Read all data rows from the sheet.
  2. For each row that needs processing (Call Link set + STT Status
     empty/error/pending):
       a. Parse date/time.
       b. Upsert a call record in PostgreSQL.
       c. Push a job onto the BullMQ queue (bullmq:audio_processing).
       d. Mark the sheet cell STT Status = 'processing'.
  3. Fetch all completed/errored google_sheets-source calls from DB
     and write analysis results back to their sheet rows.
"""

import logging
from datetime import date, time, datetime
from typing import Optional
import time as _time
import traceback

from src.config import Config
from src.sheets_client import SheetsClient, SheetRow
from src.db import (
    upsert_call,
    get_pending_sheet_calls,
    create_manager_user,
)
from src.queue_client import QueueClient

logger = logging.getLogger(__name__)


def _parse_date(raw: str) -> Optional[date]:
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    logger.warning("Cannot parse date", extra={"raw": raw})
    return None


def _parse_time(raw: str) -> Optional[time]:
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(raw.strip(), fmt).time()
        except ValueError:
            continue
    logger.warning("Cannot parse time", extra={"raw": raw})
    return None


class Pipeline:
    def __init__(self):
        sa_info = Config.service_account_info()
        self.sheets = SheetsClient(
            service_account_info=sa_info,
            spreadsheet_id=Config.GOOGLE_SHEETS_ID,
            sheet_name=Config.SHEET_NAME,
        )

        # Initialise queue client with logging and fail-fast on error
        try:
            self.queue = QueueClient(
                redis_url=Config.REDIS_URL,
                queue_name=Config.QUEUE_NAME,
            )
            logger.info("Queue client initialised", extra={"redis_url": Config.REDIS_URL, "queue_name": Config.QUEUE_NAME})
        except Exception:
            logger.exception("Failed to initialise QueueClient", extra={"redis_url": Config.REDIS_URL, "queue_name": Config.QUEUE_NAME})
            raise

        logger.info("Pipeline initialised")

    def run(self):
        logger.info("Starting sync cycle")
        self._ingest_new_rows()
        self._write_back_results()
        logger.info("Sync cycle complete")

    # ── Phase 1: sheet → queue ────────────────────────────────────────────

    def _ingest_new_rows(self):
        rows = self.sheets.read_data_rows()
        queued = 0
        skipped = 0
        for row in rows:
            if not row.needs_processing:
                logger.debug(
                    "Skipping row (already processed or no call link)",
                    extra={
                        "row": row.sheet_row_number,
                        "manager": row.man_name,
                        "client_phone": row.client_phone,
                        "stt_status": getattr(row, 'stt_status', '?'),
                        "call_link": row.call_link or '—',
                    },
                )
                skipped += 1
                continue

            logger.info(
                "Processing row",
                extra={
                    "row": row.sheet_row_number,
                    "manager_id": row.man_id,
                    "manager_name": row.man_name,
                    "client_phone": row.client_phone,
                    "date": row.date,
                    "time": row.time,
                    "duration_s": row.duration_seconds,
                    "call_link": row.call_link,
                    "chat_link": row.chat_link or '—',
                },
            )

            parsed_date = _parse_date(row.date)
            parsed_time = _parse_time(row.time)

            if not parsed_date or not parsed_time:
                logger.warning(
                    "Skipping row with unparsable date/time",
                    extra={"row": row.sheet_row_number, "date": row.date, "time": row.time},
                )
                skipped += 1
                continue

            try:
                # Auto-create manager account
                manager_user_id = create_manager_user(
                    database_url=Config.DATABASE_URL,
                    manager_id=row.man_id,
                    manager_name=row.man_name,
                )
                logger.debug(
                    "Manager user ensured",
                    extra={
                        "manager_user_id": manager_user_id,
                        "manager_id": row.man_id,
                        "manager_name": row.man_name,
                    },
                )
                
                call_id, should_enqueue = upsert_call(
                    database_url=Config.DATABASE_URL,
                    manager_id=row.man_id,
                    manager_name=row.man_name,
                    client_phone=row.client_phone,
                    client_id=row.client_id or None,
                    duration=row.duration_seconds,
                    call_link=row.call_link,
                    chat_link=row.chat_link or None,
                    call_date=parsed_date,
                    call_time=parsed_time,
                )
                if not should_enqueue:
                    logger.debug(
                        "Skipping row (job already in queue or completed)",
                        extra={"call_id": call_id, "row": row.sheet_row_number},
                    )
                    skipped += 1
                    continue
                logger.info(
                    "Call upserted to DB",
                    extra={
                        "call_id": call_id,
                        "row": row.sheet_row_number,
                        "manager": row.man_name,
                        "client_phone": row.client_phone,
                        "call_date": str(parsed_date),
                        "call_time": str(parsed_time),
                    },
                )

                # Push job to queue with timing and payload logging
                payload = {"call_id": call_id, "call_link": row.call_link, "chat_link": row.chat_link or ""}
                logger.info("Processing job from sheet", extra={"call_id": call_id, "row": row.sheet_row_number})
                logger.debug("Pushing job to queue", extra={"payload_sample": payload})
                push_start = _time.perf_counter()
                try:
                    self.queue.push_job(
                        call_id=call_id,
                        call_link=row.call_link,
                        chat_link=row.chat_link or "",
                    )
                    push_duration = _time.perf_counter() - push_start
                    logger.info("Job pushed to queue", extra={"call_id": call_id, "duration_s": push_duration})
                except Exception:
                    logger.exception("Failed to push job to queue", extra={"call_id": call_id, "row": row.sheet_row_number, "payload": payload})
                    # Do not mark row as processing if queue push failed
                    skipped += 1
                    continue

                # Mark sheet row as processing only after queue push succeeded
                try:
                    self.sheets.mark_row_processing(row.sheet_row_number)
                except Exception:
                    logger.exception("Failed to mark sheet row as processing", extra={"row": row.sheet_row_number, "call_id": call_id})
                    # still count as queued (job is in queue), but surface the sheet write failure
                queued += 1
            except Exception:
                logger.exception(
                    "Failed to ingest row",
                    extra={"row": row.sheet_row_number},
                )

        logger.info(
            "Ingest phase done",
            extra={"queued": queued, "skipped": skipped},
        )

    # ── Phase 2: DB results → sheet ───────────────────────────────────────

    def _write_back_results(self):
        # Fetch pending/completed calls from DB with timing/logging
        db_start = _time.perf_counter()
        try:
            completed_calls = get_pending_sheet_calls(Config.DATABASE_URL)
            db_duration = _time.perf_counter() - db_start
            logger.info("Fetched pending/completed calls from DB", extra={"count": len(completed_calls) if completed_calls else 0, "duration_s": db_duration})
        except Exception:
            logger.exception("Failed to fetch pending/completed calls from DB", extra={})
            return

        if not completed_calls:
            logger.info("No completed calls to write back")
            return

        logger.info("Load phase starting", extra={"completed_calls_count": len(completed_calls)})

        # Build a lookup: call_link → (sheet row number, current stt_status)
        rows = self.sheets.read_data_rows()
        link_to_row: dict[str, tuple[int, str]] = {
            r.call_link: (r.sheet_row_number, r.stt_status)
            for r in rows
            if r.call_link
        }

        written = 0
        for call in completed_calls:
            call_link = call.get("call_link", "")
            entry = link_to_row.get(call_link)
            if not entry:
                logger.debug("No sheet row found for call_link", extra={"call_link": call_link, "call_id": call.get("id")})
                continue
            row_number, current_status = entry

            status = call.get("status", "error")
            stt_status = "done" if status == "completed" else "error"

            # Skip rows already written back to avoid redundant API calls
            if current_status in ("done", "error"):
                logger.debug(
                    "Skipping write-back (already synced)",
                    extra={"call_id": call.get("id"), "row": row_number, "stt_status": current_status},
                )
                continue
            processed_at_raw = call.get("processed_at")
            processed_at_str = (
                processed_at_raw.isoformat() if processed_at_raw else ""
            )

            logger.info(
                "Writing result back to sheet",
                extra={
                    "call_id": call.get("id"),
                    "row": row_number,
                    "stt_status": stt_status,
                    "quality_score": call.get("quality_score"),
                    "script_match": call.get("script_match"),
                    "errors_free": call.get("errors_free"),
                    "llm_provider": call.get("llm_provider"),
                    "processed_at": processed_at_str,
                },
            )
            try:
                write_start = _time.perf_counter()
                self.sheets.write_analysis_result(
                    row_number=row_number,
                    stt_status=stt_status,
                    quality=call.get("quality_score"),
                    script_match=call.get("script_match"),
                    errors_free=call.get("errors_free"),
                    recommendation=call.get("recommendation") or "",
                    brief=call.get("brief") or "",
                    next_best_action=call.get("next_best_action") or "",
                    llm_provider=call.get("llm_provider") or "",
                    processed_at=processed_at_str,
                    error_message=call.get("error_message") or "",
                )
                write_duration = _time.perf_counter() - write_start
                logger.info(
                    "Sheet row updated",
                    extra={"call_id": call.get("id"), "row": row_number, "stt_status": stt_status, "write_duration_s": write_duration},
                )
                written += 1
            except Exception:
                logger.exception(
                    "Failed to write result back to sheet",
                    extra={"call_id": call.get("id")},
                )

        logger.info("Write-back phase done", extra={"written": written})
