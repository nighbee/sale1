"""
Google Sheets client.

Sheet column layout (0-indexed, row 1 = header):
  0  Date
  1  Time
  2  Man id
  3  Man name
  4  Client phone
  5  Client id
  6  Duration
  7  Call Link
  8  Chat Link
  9  STT Status
  10 Quality of Call
  11 Script Match
  12 Errors Free
  13 Recommendation
  14 Brief
  15 Next Best Action
  16 LLM Provider
  17 Processed At  (STT/analytics result timestamp)
  18 Error Message
  19 Processed At  (secondary – written same as 17 for compatibility)
  20 Error Message (secondary)
"""

import logging
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Column indexes (0-based)
COL_DATE = 0
COL_TIME = 1
COL_MAN_ID = 2
COL_MAN_NAME = 3
COL_CLIENT_PHONE = 4
COL_CLIENT_ID = 5
COL_DURATION = 6
COL_CALL_LINK = 7
COL_CHAT_LINK = 8
COL_STT_STATUS = 9
COL_QUALITY = 10
COL_SCRIPT_MATCH = 11
COL_ERRORS_FREE = 12
COL_RECOMMENDATION = 13
COL_BRIEF = 14
COL_NEXT_BEST_ACTION = 15
COL_LLM_PROVIDER = 16
COL_PROCESSED_AT_1 = 17
COL_ERROR_MSG_1 = 18
COL_PROCESSED_AT_2 = 19
COL_ERROR_MSG_2 = 20

# Total columns = 21 (A–U)
TOTAL_COLS = 21

# A row is "ready to process" when Call Link is set AND STT Status is
# empty, "error", or "pending" (re-queue on error to allow retries).
# Include 'processing' so rows stuck in that state (e.g. after Redis wipe)
# are re-queued on the next sync cycle instead of being silently skipped.
PROCESSABLE_STATUSES = {"", "error", "pending", "processing"}


class SheetRow:
    def __init__(self, row_index: int, values: list):
        """row_index is the 0-based data row index (0 = first data row after header)."""
        self.row_index = row_index
        # Pad to avoid index errors
        padded = values + [""] * (TOTAL_COLS - len(values))
        self.date: str = padded[COL_DATE]
        self.time: str = padded[COL_TIME]
        self.man_id: str = padded[COL_MAN_ID]
        self.man_name: str = padded[COL_MAN_NAME]
        self.client_phone: str = padded[COL_CLIENT_PHONE]
        self.client_id: str = padded[COL_CLIENT_ID]
        self.duration_raw: str = padded[COL_DURATION]
        self.call_link: str = padded[COL_CALL_LINK]
        self.chat_link: str = padded[COL_CHAT_LINK]
        self.stt_status: str = padded[COL_STT_STATUS]

    @property
    def needs_processing(self) -> bool:
        return bool(self.call_link) and self.stt_status.strip().lower() in PROCESSABLE_STATUSES

    @property
    def duration_seconds(self) -> int:
        """Parse duration from HH:MM:SS, plain seconds integer, or raw number."""
        raw = self.duration_raw.strip()
        if not raw:
            return 0
        if ":" in raw:
            parts = raw.split(":")
            try:
                if len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                if len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
            except ValueError:
                return 0
        try:
            return int(float(raw))
        except ValueError:
            return 0

    # Sheet row number (1-based, +2 because row 1 is the header)
    @property
    def sheet_row_number(self) -> int:
        return self.row_index + 2


class SheetsClient:
    def __init__(self, service_account_info: dict, spreadsheet_id: str, sheet_name: str):
        creds = service_account.Credentials.from_service_account_info(
            service_account_info, scopes=SCOPES
        )
        service = build("sheets", "v4", credentials=creds, cache_discovery=False)
        self._sheets = service.spreadsheets()
        self.spreadsheet_id = spreadsheet_id
        self.sheet_name = sheet_name
        logger.info(
            "SheetsClient initialised",
            extra={"spreadsheet_id": spreadsheet_id, "sheet": sheet_name},
        )

    def _range(self, row_number: Optional[int] = None, col_letter: Optional[str] = None) -> str:
        if row_number and col_letter:
            return f"{self.sheet_name}!{col_letter}{row_number}"
        return f"{self.sheet_name}!A2:U"

    def read_data_rows(self) -> list[SheetRow]:
        """Return all data rows (skipping header row 1)."""
        result = (
            self._sheets.values()
            .get(spreadsheetId=self.spreadsheet_id, range=self._range())
            .execute()
        )
        raw_rows = result.get("values", [])
        rows = [SheetRow(i, r) for i, r in enumerate(raw_rows)]
        logger.info("Read sheet rows", extra={"count": len(rows)})
        return rows

    def mark_row_processing(self, row_number: int):
        """Set STT Status = 'processing' while the job is in-flight."""
        self._write_cell(row_number, COL_STT_STATUS, "processing")
        logger.debug("Marked row as processing", extra={"row": row_number})

    def write_analysis_result(
        self,
        row_number: int,
        stt_status: str,
        quality: Optional[int],
        script_match: Optional[int],
        errors_free: Optional[int],
        recommendation: str,
        brief: str,
        next_best_action: str,
        llm_provider: str,
        processed_at: str,
        error_message: str,
    ):
        """Write the full analysis result back to the sheet row."""
        # Build a values list covering columns J through U (10–20, 0-indexed).
        # We write a single range update for efficiency.
        update_values = [
            stt_status,
            quality if quality is not None else "",
            script_match if script_match is not None else "",
            errors_free if errors_free is not None else "",
            recommendation,
            brief,
            next_best_action,
            llm_provider,
            processed_at,
            error_message,
            processed_at,   # col 19 – secondary duplicate
            error_message,  # col 20 – secondary duplicate
        ]
        col_start = "J"  # index 9
        col_end = "U"    # index 20
        range_notation = f"{self.sheet_name}!{col_start}{row_number}:{col_end}{row_number}"
        body = {"values": [update_values]}
        self._sheets.values().update(
            spreadsheetId=self.spreadsheet_id,
            range=range_notation,
            valueInputOption="USER_ENTERED",
            body=body,
        ).execute()
        logger.info(
            "Wrote analysis result to sheet",
            extra={"row": row_number, "status": stt_status},
        )

    # ── helpers ──────────────────────────────────────────────────────────────

    def _write_cell(self, row_number: int, col_index: int, value):
        col_letter = chr(ord("A") + col_index)
        range_notation = f"{self.sheet_name}!{col_letter}{row_number}"
        self._sheets.values().update(
            spreadsheetId=self.spreadsheet_id,
            range=range_notation,
            valueInputOption="USER_ENTERED",
            body={"values": [[value]]},
        ).execute()
