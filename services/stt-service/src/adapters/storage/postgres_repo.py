import psycopg2
from psycopg2 import pool
import json
import os
import logging

logger = logging.getLogger(__name__)

# Connection pool
_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(1, 20, os.getenv("DATABASE_URL"))
    return _pool

def save_transcript(call_id, transcript_json, stt_provider):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO calls_schema.transcripts (id, call_id, speaker_diarized_json, stt_provider)
            VALUES (gen_random_uuid(), %s, %s, %s)
            ON CONFLICT (call_id) DO UPDATE SET
                speaker_diarized_json = EXCLUDED.speaker_diarized_json,
                stt_provider = EXCLUDED.stt_provider,
                processed_at = NOW()
        """
        cur.execute(query, (call_id, json.dumps(transcript_json), stt_provider))
        conn.commit()
    finally:
        if cur:
            cur.close()
        conn.rollback()  # Ensure clean state
        get_pool().putconn(conn)

def get_latest_minio_call():
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = "SELECT id, call_link FROM calls_schema.calls WHERE call_link LIKE 'minio://%' ORDER BY created_at DESC LIMIT 1"
        cur.execute(query)
        return cur.fetchone()
    finally:
        if cur:
            cur.close()
        conn.rollback()
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
        conn.rollback()  # Ensure clean state for read-only or on failure
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
        conn.rollback()  # Ensure clean state
        get_pool().putconn(conn)

def update_call_link(call_id, call_link):
    conn = get_pool().getconn()
    cur = None
    try:
        cur = conn.cursor()
        query = "UPDATE calls_schema.calls SET call_link = %s, updated_at = NOW() WHERE id = %s"
        cur.execute(query, (call_link, call_id))
        conn.commit()
    finally:
        if cur:
            cur.close()
        conn.rollback()  # Ensure clean state
        get_pool().putconn(conn)
