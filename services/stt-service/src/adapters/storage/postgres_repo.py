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
