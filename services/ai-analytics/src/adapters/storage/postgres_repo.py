import psycopg2
import os
import json

def get_transcript(call_id):
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()
    cur.execute("SELECT speaker_diarized_json FROM calls_schema.transcripts WHERE call_id = %s", (call_id,))
    res = cur.fetchone()
    cur.close()
    conn.close()
    return res[0] if res else None

def get_active_script(company_id):
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()
    cur.execute("SELECT id, parsed_text FROM scripts_schema.scripts WHERE company_id = %s AND is_active = true LIMIT 1", (company_id,))
    res = cur.fetchone()
    cur.close()
    conn.close()
    return {"id": res[0], "parsed_text": res[1]} if res else None

def save_analysis(report):
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
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
    conn.close()
