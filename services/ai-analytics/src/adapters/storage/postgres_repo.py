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
        # Use simple pool for now
        _pool = pool.SimpleConnectionPool(1, 10, os.getenv("DATABASE_URL"))
    return _pool

def get_transcript(call_id):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM calls_schema.transcripts WHERE call_id = %s", (call_id,))
        return cur.fetchone()
    finally:
        get_pool().putconn(conn)

def update_call_status(call_id, status):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        query = "UPDATE calls_schema.calls SET status = %s, updated_at = NOW() WHERE id = %s"
        cur.execute(query, (status, call_id))
        conn.commit()
        cur.close()
    finally:
        get_pool().putconn(conn)

def get_team_script(manager_id):
    """Get team-specific script for a manager."""
    conn = get_pool().getconn()
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
        get_pool().putconn(conn)

def get_company_settings_by_manager(manager_id):
    """Get company settings using manager_id. Returns default settings if not found."""
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT c.llm_provider 
            FROM auth_schema.companies c
            JOIN auth_schema.users u ON u.company_id = c.id
            WHERE u.manager_id = %s
            LIMIT 1
        """, (manager_id,))
        return cur.fetchone()
    finally:
        get_pool().putconn(conn)

def get_call(call_id):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM calls_schema.calls WHERE id = %s", (call_id,))
        return cur.fetchone()
    finally:
        get_pool().putconn(conn)

def get_company_id_by_call(call_id):
    """Get company_id by call_id. Returns None if not found (for backward compatibility)."""
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.company_id FROM auth_schema.users u
            JOIN calls_schema.calls c ON c.manager_id = u.manager_id
            WHERE c.id = %s LIMIT 1
        """, (call_id,))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.warning("Could not resolve company_id", extra={"call_id": call_id, "error": str(e)})
        return None
    finally:
        get_pool().putconn(conn)

def get_active_script_by_manager(manager_id):
    """Get active script for a manager's company. Returns None if not found."""
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT s.* FROM scripts_schema.scripts s
            JOIN auth_schema.users u ON s.company_id = u.company_id
            WHERE u.manager_id = %s AND s.is_active = true
            ORDER BY s.version DESC LIMIT 1
        """, (manager_id,))
        return cur.fetchone()
    finally:
        get_pool().putconn(conn)

def save_analysis(report):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO calls_schema.analysis_reports
            (id, call_id, script_id, quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action, llm_provider)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
        cur.close()
    finally:
        get_pool().putconn(conn)

def create_notification(user_id, n_type, subject, message):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO logs_schema.notifications (id, user_id, type, subject, message)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
        """
        cur.execute(query, (user_id, n_type, subject, message))
        conn.commit()
        cur.close()
    finally:
        get_pool().putconn(conn)

def log_processing_event(call_id, service_name, status, error_message=None, retry_count=0):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO logs_schema.processing_logs (id, call_id, service_name, status, error_message, retry_count)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
        """
        cur.execute(query, (call_id, service_name, status, error_message, retry_count))
        conn.commit()
        cur.close()
    finally:
        get_pool().putconn(conn)

def get_company_admin_by_manager(manager_id):
    """Get company admin user by manager_id. Returns None if not found."""
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT u.id FROM auth_schema.users u
            JOIN auth_schema.users u2 ON u2.company_id = u.company_id
            WHERE u2.manager_id = %s AND u.role = 'tenant_admin'
            LIMIT 1
        """, (manager_id,))
        return cur.fetchone()
    finally:
        get_pool().putconn(conn)
