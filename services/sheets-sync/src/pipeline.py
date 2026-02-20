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

from src.config import Config
from src.sheets_client import SheetsClient, SheetRow
from src.db import (
    resolve_company_id,
    upsert_call,
    get_pending_sheet_calls,
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
        self.queue = QueueClient(
            redis_url=Config.REDIS_URL,
            queue_name=Config.QUEUE_NAME,
        )
        self.company_id = resolve_company_id(Config.DATABASE_URL, Config.COMPANY_ID)
        logger.info("Pipeline initialised", extra={"company_id": self.company_id})

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
                skipped += 1
                continue

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
                call_id = upsert_call(
                    database_url=Config.DATABASE_URL,
                    company_id=self.company_id,
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
                self.queue.push_job(
                    call_id=call_id,
                    company_id=self.company_id,
                    call_link=row.call_link,
                    chat_link=row.chat_link or "",
                )
                self.sheets.mark_row_processing(row.sheet_row_number)
                queued += 1
            except Exception as e:
                logger.error(
                    "Failed to ingest row",
                    extra={"row": row.sheet_row_number, "error": str(e)},
                )

        logger.info(
            "Ingest phase done",
            extra={"queued": queued, "skipped": skipped},
        )

    # ── Phase 2: DB results → sheet ───────────────────────────────────────

    def _write_back_results(self):
        completed_calls = get_pending_sheet_calls(Config.DATABASE_URL, self.company_id)
        if not completed_calls:
            return

        # Build a lookup: call_link → sheet row number
        rows = self.sheets.read_data_rows()
        link_to_row: dict[str, int] = {
            r.call_link: r.sheet_row_number
            for r in rows
            if r.call_link
        }

        written = 0
        for call in completed_calls:
            call_link = call.get("call_link", "")
            row_number = link_to_row.get(call_link)
            if not row_number:
                continue

            status = call.get("status", "error")
            stt_status = "completed" if status == "completed" else "error"
            processed_at_raw = call.get("processed_at")
            processed_at_str = (
                processed_at_raw.isoformat() if processed_at_raw else ""
            )

            try:
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
                written += 1
            except Exception as e:
                logger.error(
                    "Failed to write result back to sheet",
                    extra={"call_id": call.get("id"), "error": str(e)},
                )

        logger.info("Write-back phase done", extra={"written": written})
