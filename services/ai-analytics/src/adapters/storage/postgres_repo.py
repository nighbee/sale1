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

def get_team_script(company_id, manager_id):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # manager_id from external sources (e.g. Google Sheets) may be a short
        # integer string, not a UUID — guard against the DB type error.
        try:
            cur.execute(
                "SELECT team_id FROM auth_schema.users WHERE id = %s AND company_id = %s",
                (manager_id, company_id),
            )
            res = cur.fetchone()
        except psycopg2.errors.InvalidTextRepresentation:
            conn.rollback()
            logger.debug(
                "manager_id is not a valid UUID, falling back to company script",
                extra={"manager_id": manager_id, "company_id": company_id},
            )
            return get_active_script(company_id)

        if not res or not res['team_id']:
            # Fallback to company active script
            return get_active_script(company_id)

        team_id = res['team_id']
        cur.execute("""
            SELECT * FROM scripts_schema.scripts
            WHERE team_id = %s AND is_active = true
            ORDER BY version DESC LIMIT 1
        """, (team_id,))
        script = cur.fetchone()
        if not script:
            return get_active_script(company_id)
        return script
    finally:
        get_pool().putconn(conn)

def get_company_settings(company_id):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT llm_provider FROM auth_schema.companies WHERE id = %s", (company_id,))
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
    finally:
        get_pool().putconn(conn)

def get_active_script(company_id):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT * FROM scripts_schema.scripts
            WHERE company_id = %s AND is_active = true
            ORDER BY version DESC LIMIT 1
        """, (company_id,))
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

def get_company_admin(company_id):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id FROM auth_schema.users
            WHERE company_id = %s AND role = 'tenant_admin'
            LIMIT 1
        """, (company_id,))
        return cur.fetchone()
    finally:
        get_pool().putconn(conn)
