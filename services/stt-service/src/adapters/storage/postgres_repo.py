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
        _pool = pool.SimpleConnectionPool(1, 10, os.getenv("DATABASE_URL"))
    return _pool

def save_transcript(call_id, transcript_json, stt_provider):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO calls_schema.transcripts (id, call_id, speaker_diarized_json, stt_provider)
            VALUES (gen_random_uuid(), %s, %s, %s)
        """
        cur.execute(query, (call_id, json.dumps(transcript_json), stt_provider))
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

def update_call_link(call_id, call_link):
    conn = get_pool().getconn()
    try:
        cur = conn.cursor()
        query = "UPDATE calls_schema.calls SET call_link = %s, updated_at = NOW() WHERE id = %s"
        cur.execute(query, (call_link, call_id))
        conn.commit()
        cur.close()
    finally:
        get_pool().putconn(conn)
