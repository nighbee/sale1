import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import json
import os
import logging

logger = logging.getLogger(__name__)

# Connection pool
_pool = None

def get_pool():
    global _pool
    if _pool is None:
        # Threaded pool for gRPC and concurrent processing
        _pool = pool.ThreadedConnectionPool(1, 20, os.getenv("DATABASE_URL"))
    return _pool

def get_transcript(call_id):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM calls_schema.transcripts WHERE call_id = %s", (call_id,))
        return cur.fetchone()
    finally:
        if cur:
            cur.close()
        get_pool().putconn(conn)

def update_call_status(call_id, status):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = "UPDATE calls_schema.calls SET status = %s, updated_at = NOW() WHERE id = %s"
        cur.execute(query, (status, call_id))
        conn.commit()
    finally:
        if cur:
            cur.close()
        conn.rollback()  # Ensure clean state for read-only
        get_pool().putconn(conn)

def get_team_script(manager_id):
    """Get team-specific script for a manager."""
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Try to get team_id by manager_id
        try:
            cur.execute(
                "SELECT team_id FROM auth_schema.users WHERE manager_id = %s",
                (manager_id,),
            )
            res = cur.fetchone()
        except psycopg2.errors.InvalidTextRepresentation:
            logger.debug(
                "manager_id is not valid for team lookup",
                extra={"manager_id": manager_id},
            )
            return None

        if not res or not res.get('team_id'):
            # No team, return None
            return None

        team_id = res['team_id']
        cur.execute("""
            SELECT * FROM scripts_schema.scripts
            WHERE team_id = %s AND is_active = true
            ORDER BY version DESC LIMIT 1
        """, (team_id,))
        script = cur.fetchone()
        return script
    finally:
        if cur:
            cur.close()
        conn.rollback()  # Ensure clean state for read-only
        get_pool().putconn(conn)

def get_call(call_id):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, manager_id, duration, external_id FROM calls_schema.calls WHERE id = %s", (call_id,))
        return cur.fetchone()
    finally:
        if cur:
            cur.close()
        conn.rollback()  # Ensure clean state for read-only
        get_pool().putconn(conn)

def get_active_script_by_manager(manager_id):
    """Get active script. Returns None if not found."""
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT s.* FROM scripts_schema.scripts s
            WHERE s.is_active = true
            ORDER BY s.version DESC LIMIT 1
        """)
        return cur.fetchone()
    finally:
        if cur:
            cur.close()
        conn.rollback()  # Ensure clean state for read-only
        get_pool().putconn(conn)

def save_analysis(report):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO calls_schema.analysis_reports
            (id, call_id, script_id, quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action, llm_provider)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (call_id) DO UPDATE SET
                script_id = EXCLUDED.script_id,
                quality_score = EXCLUDED.quality_score,
                script_match = EXCLUDED.script_match,
                errors_free = EXCLUDED.errors_free,
                overall_rating = EXCLUDED.overall_rating,
                kpi = EXCLUDED.kpi,
                recommendation = EXCLUDED.recommendation,
                brief = EXCLUDED.brief,
                next_best_action = EXCLUDED.next_best_action,
                llm_provider = EXCLUDED.llm_provider,
                processed_at = NOW()
        """
        cur.execute(query, (
            report['call_id'],
            report['script_id'],
            report['quality_score'],
            report['script_match'],
            report['errors_free'],
            report['overall_rating'],
            report['kpi'],
            report['recommendation'],
            report['brief'],
            report['next_best_action'],
            report['llm_provider']
        ))
        conn.commit()
    finally:
        if cur:
            cur.close()
        get_pool().putconn(conn)

def create_notification(user_id, n_type, subject, message):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO logs_schema.notifications (id, user_id, type, subject, message)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
        """
        cur.execute(query, (user_id, n_type, subject, message))
        conn.commit()
    finally:
        if cur:
            cur.close()
        get_pool().putconn(conn)

def log_processing_event(call_id, service_name, status, error_message=None, retry_count=0):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO logs_schema.processing_logs (id, call_id, service_name, status, error_message, retry_count)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
        """
        cur.execute(query, (call_id, service_name, status, error_message, retry_count))
        conn.commit()
    finally:
        if cur:
            cur.close()
        get_pool().putconn(conn)

def get_admin_user():
    """Get first super_admin user. Returns None if not found."""
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id FROM auth_schema.users
            WHERE role = 'super_admin'
            LIMIT 1
        """)
        return cur.fetchone()
    finally:
        if cur:
            cur.close()
        get_pool().putconn(conn)
