"""
PostgreSQL helpers.
- Upsert a call row in calls_schema.calls (source='google_sheets').
- Look up a completed analysis for a given call_id.
- Resolve the company_id for the google_sheets integration.
"""

import logging
import uuid
from datetime import date, time, datetime
from typing import Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


def _dsn(database_url: str) -> str:
    """Convert postgres:// URI or libpq DSN string to libpq format."""
    if database_url.startswith("postgres://") or database_url.startswith("postgresql://"):
        return database_url
    return database_url  # already libpq key=value form


def get_connection(database_url: str):
    return psycopg2.connect(_dsn(database_url))


def get_user_uuid(manager_id: str) -> str:
    """Return a deterministic UUID for a given manager_id string."""
    try:
        # Check if already a valid UUID
        return str(uuid.UUID(manager_id))
    except (ValueError, AttributeError):
        # Generate deterministic UUID from name/string
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, str(manager_id)))


def ensure_user_exists(database_url: str, company_id: str, manager_id: str, manager_name: str):
    """Ensure a user record exists for the given manager_id in auth_schema.users."""
    user_id = get_user_uuid(manager_id)
    conn = get_connection(database_url)
    try:
        with conn.cursor() as cur:
            # Try to find by ID
            cur.execute("SELECT id FROM auth_schema.users WHERE id = %s", (user_id,))
            if cur.fetchone():
                return

            # Not found, create it
            # Generate a dummy email
            email = f"manager_{user_id[:8]}@example.com"
            if "@" in manager_id:
                email = manager_id

            cur.execute(
                """
                INSERT INTO auth_schema.users
                (id, company_id, email, password_hash, role, manager_name, is_active, first_name, last_name)
                VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s, '')
                ON CONFLICT (id) DO NOTHING
                """,
                (user_id, company_id, email, 'disabled', 'sales_rep', manager_name, manager_name)
            )
            conn.commit()
            logger.info("Auto-created user for manager",
                        extra={"manager_id": manager_id, "user_id": user_id, "manager_name": manager_name})
    except Exception as e:
        logger.warning("Could not auto-create user", extra={"manager_id": manager_id, "error": str(e)})
        if not conn.closed:
            conn.rollback()
    finally:
        conn.close()


def resolve_company_id(database_url: str, forced_company_id: str) -> str:
    """Return the company_id to use.

    If forced_company_id is set, return it.
    Otherwise look for the first active google_sheets integration in the DB.
    """
    if forced_company_id:
        return forced_company_id
    conn = get_connection(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT company_id FROM integrations_schema.integrations
                WHERE integration_type = 'google_sheets' AND is_active = TRUE
                ORDER BY created_at LIMIT 1
                """,
            )
            row = cur.fetchone()
            if row:
                return str(row[0])
            raise RuntimeError(
                "No active google_sheets integration found. "
                "Set COMPANY_ID env var or create the integration."
            )
    finally:
        conn.close()


def upsert_call(
    database_url: str,
    company_id: str,
    manager_id: str,
    manager_name: str,
    client_phone: str,
    client_id: Optional[str],
    duration: int,
    call_link: str,
    chat_link: Optional[str],
    call_date: date,
    call_time: time,
) -> tuple[str, bool]:
    """Insert or re-use (by call_link + company_id) a call record.

    Returns (call_uuid, should_enqueue):
      - should_enqueue=True  → freshly inserted, push to queue
      - should_enqueue=True  → existing with status 'error', reset to pending and retry
      - should_enqueue=False → already pending/processing/completed, skip push
    """
    # Ensure user exists before inserting call
    user_id = manager_id
    if manager_id:
        ensure_user_exists(database_url, company_id, manager_id, manager_name)
        user_id = get_user_uuid(manager_id)

    conn = get_connection(database_url)
    try:
        with conn.cursor() as cur:
            # Check existing
            cur.execute(
                """
                SELECT id, status FROM calls_schema.calls
                WHERE company_id = %s AND call_link = %s
                LIMIT 1
                """,
                (company_id, call_link),
            )
            existing = cur.fetchone()
            if existing:
                call_id = str(existing[0])
                existing_status = existing[1]
                if existing_status == "error":
                    # Reset to pending so it gets retried
                    cur.execute(
                        "UPDATE calls_schema.calls SET status = 'pending' WHERE id = %s",
                        (call_id,),
                    )
                    conn.commit()
                    logger.info(
                        "Call reset for retry",
                        extra={"call_id": call_id, "prev_status": existing_status},
                    )
                    return call_id, True
                logger.debug(
                    "Call already queued or completed, skipping",
                    extra={"call_id": call_id, "status": existing_status},
                )
                return call_id, False

            call_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO calls_schema.calls
                  (id, company_id, manager_id, manager_name, client_phone,
                   client_id, duration, call_link, chat_link,
                   call_date, call_time, status, source)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'google_sheets')
                """,
                (
                    call_id,
                    company_id,
                    user_id,
                    manager_name,
                    client_phone,
                    client_id or None,
                    duration,
                    call_link,
                    chat_link or None,
                    call_date,
                    call_time,
                ),
            )
            conn.commit()
            logger.info("Inserted call", extra={"call_id": call_id, "call_link": call_link})
            return call_id, True
    finally:
        conn.close()


def get_analysis_result(database_url: str, call_id: str) -> Optional[dict]:
    """Return the analysis report dict if the call is completed, else None."""
    conn = get_connection(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    c.status,
                    ar.quality_score,
                    ar.script_match,
                    ar.errors_free,
                    ar.recommendation,
                    ar.brief,
                    ar.next_best_action,
                    ar.llm_provider,
                    ar.processed_at,
                    pl.error_message
                FROM calls_schema.calls c
                LEFT JOIN calls_schema.analysis_reports ar ON ar.call_id = c.id
                LEFT JOIN LATERAL (
                    SELECT error_message FROM logs_schema.processing_logs
                    WHERE call_id = c.id
                    ORDER BY created_at DESC LIMIT 1
                ) pl ON TRUE
                WHERE c.id = %s
                """,
                (call_id,),
            )
            row = cur.fetchone()
            if row:
                return dict(row)
            return None
    finally:
        conn.close()


def get_pending_sheet_calls(database_url: str, company_id: str) -> list[dict]:
    """Return calls that originated from google_sheets and are now completed or errored."""
    conn = get_connection(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    c.id,
                    c.call_link,
                    c.status,
                    ar.quality_score,
                    ar.script_match,
                    ar.errors_free,
                    ar.recommendation,
                    ar.brief,
                    ar.next_best_action,
                    ar.llm_provider,
                    ar.processed_at,
                    pl.error_message
                FROM calls_schema.calls c
                LEFT JOIN calls_schema.analysis_reports ar ON ar.call_id = c.id
                LEFT JOIN LATERAL (
                    SELECT error_message FROM logs_schema.processing_logs
                    WHERE call_id = c.id
                    ORDER BY created_at DESC LIMIT 1
                ) pl ON TRUE
                WHERE c.company_id = %s
                  AND c.source = 'google_sheets'
                  AND c.status IN ('completed', 'error')
                """,
                (company_id,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
