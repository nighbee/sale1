"""
PostgreSQL helpers.
- Upsert a call row in calls_schema.calls (source='google_sheets').
- Look up a completed analysis for a given call_id.
"""

import logging
import uuid
from datetime import date, time, datetime
from typing import Optional

import bcrypt
import psycopg2
import psycopg2.extras
from psycopg2 import errors as psy_errors

logger = logging.getLogger(__name__)


def _dsn(database_url: str) -> str:
    """Convert postgres:// URI or libpq DSN string to libpq format."""
    if database_url.startswith("postgres://") or database_url.startswith("postgresql://"):
        return database_url
    return database_url  # already libpq key=value form


def get_connection(database_url: str):
    return psycopg2.connect(_dsn(database_url))


def _ensure_manager_user_exists(cur, manager_id: str, manager_name: str):
    """Check if a user with given manager_id exists in auth_schema.users.
    If not, create one.
    """
    cur.execute(
        "SELECT id FROM auth_schema.users WHERE manager_id = %s",
        (manager_id,),
    )
    row = cur.fetchone()
    if row:
        logger.debug("Manager user already exists", extra={"manager_id": manager_id, "user_id": str(row[0])})
        return str(row[0])

    # Not found, create a placeholder user. We perform an insert and handle
    # concurrent races where another process inserts the same manager at
    # the same time by catching UniqueViolation and selecting the existing
    # user afterwards.
    user_uuid = str(uuid.uuid4())
    # Generate a safe email from manager_id/name
    safe_id = "".join(c for c in str(manager_id) if c.isalnum())
    email = f"manager_{safe_id}@salesai.local"

    # Split name into first/last if possible
    parts = manager_name.split(maxsplit=1)
    first_name = parts[0] if len(parts) > 0 else manager_name
    last_name = parts[1] if len(parts) > 1 else ""

    logger.info(
        "Creating missing manager user",
        extra={
            "manager_id": manager_id,
            "manager_name": manager_name,
            "user_uuid": user_uuid,
        },
    )

    # Hash the default password
    default_password = "SaleAI!2016"
    password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        cur.execute(
            """
            INSERT INTO auth_schema.users
              (id, email, password_hash, role, manager_id, manager_name, first_name, last_name, is_active)
            VALUES
              (%s, %s, %s, 'sales_rep', %s, %s, %s, %s, TRUE)
            """,
            (user_uuid, email, password_hash, manager_id, manager_name, first_name, last_name),
        )

        # Commit makes the creation durable for other connections
        cur.connection.commit()
        return user_uuid
    except Exception as e:
        # If insertion failed due to concurrent insert (unique violation),
        # rollback and fetch the existing user id. For other errors, re-raise
        # after logging.
        if isinstance(e, psy_errors.UniqueViolation) or getattr(e, 'pgcode', '') == psy_errors.UniqueViolation.pgcode:
            try:
                cur.connection.rollback()
            except Exception:
                pass
            cur.execute(
                "SELECT id FROM auth_schema.users WHERE manager_id = %s",
                (manager_id,),
            )
            row = cur.fetchone()
            if row:
                return str(row[0])
        # Log unexpected exception and re-raise so caller can handle it
        logger.exception("Failed to create manager user", extra={"manager_id": manager_id, "error": str(e)})
        raise


def upsert_call(
    database_url: str,
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
    """Insert or re-use (by call_link) a call record.

    Returns (call_uuid, should_enqueue):
      - should_enqueue=True  → freshly inserted, push to queue
      - should_enqueue=True  → existing with status 'error', reset to pending and retry
      - should_enqueue=False → already pending/processing/completed, skip push
    """
    conn = get_connection(database_url)
    try:
        with conn.cursor() as cur:
            # 0. Ensure manager user exists
            _ensure_manager_user_exists(cur, manager_id, manager_name)

            # 1. Check existing
            cur.execute(
                """
                SELECT id, status FROM calls_schema.calls
                WHERE call_link = %s
                LIMIT 1
                """,
                (call_link,),
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
                  (id, manager_id, manager_name, client_phone,
                   client_id, duration, call_link, chat_link,
                   call_date, call_time, status, source)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'google_sheets')
                """,
                (
                    call_id,
                    manager_id,
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


def get_pending_sheet_calls(database_url: str) -> list[dict]:
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
                WHERE c.source = 'google_sheets'
                  AND c.status IN ('completed', 'error')
                """,
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def create_manager_user(
    database_url: str,
    manager_id: str,
    manager_name: str,
) -> str:
    """Create or upsert a sales_rep user account for a manager.
    
    Returns the user UUID.
    Email: manager_name_normalized@gmail.com (spaces → underscores, lowercase)
    Password: manager_name (plain text stored as bcrypt hash)
    """
    import bcrypt
    
    # Normalize email: spaces to underscores, lowercase
    email_local = manager_name.lower().replace(" ", "_")
    email = f"{email_local}@gmail.com"
    
    # Password = manager_name as-is
    password_plain = manager_name
    password_hash = bcrypt.hashpw(password_plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    conn = get_connection(database_url)
    try:
        with conn.cursor() as cur:
            # Check if user exists
            cur.execute(
                """
                SELECT id FROM auth_schema.users
                WHERE manager_id = %s
                LIMIT 1
                """,
                (manager_id,),
            )
            existing = cur.fetchone()
            if existing:
                user_id = str(existing[0])
                logger.debug(
                    "Manager user already exists",
                    extra={"user_id": user_id, "manager_id": manager_id, "manager_name": manager_name},
                )
                return user_id
            
            # Create new user
            user_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO auth_schema.users
                  (id, email, password_hash, role, manager_id, manager_name, is_active)
                VALUES
                  (%s, %s, %s, 'sales_rep', %s, %s, TRUE)
                ON CONFLICT (email) DO NOTHING
                """,
                (user_id, email, password_hash, manager_id, manager_name),
            )
            conn.commit()
            logger.info(
                "Manager user created",
                extra={
                    "user_id": user_id,
                    "manager_id": manager_id,
                    "manager_name": manager_name,
                    "email": email,
                },
            )
            return user_id
    finally:
        conn.close()
