import psycopg2
import json
import os

def save_transcript(call_id, transcript_json, stt_provider):
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()

    query = """
        INSERT INTO calls_schema.transcripts (id, call_id, speaker_diarized_json, stt_provider)
        VALUES (gen_random_uuid(), %s, %s, %s)
    """
    cur.execute(query, (call_id, json.dumps(transcript_json), stt_provider))
    conn.commit()
    cur.close()
    conn.close()
