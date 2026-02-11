-- =============================================
-- Migration 003: Add Constraints and Views
-- Description: Business logic constraints and analytics views
-- Author: SalesAI Team
-- Date: 2026-02-08
-- =============================================

-- =============================================
-- Automatic status updates
-- =============================================

-- Update call status when transcript is created
CREATE OR REPLACE FUNCTION update_call_status_on_transcript()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE calls_schema.calls
    SET status = 'processing'
    WHERE id = NEW.call_id AND status = 'pending';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_created_update_status
    AFTER INSERT ON calls_schema.transcripts
    FOR EACH ROW
    EXECUTE FUNCTION update_call_status_on_transcript();

-- =============================================

-- Update call status when analysis is completed
CREATE OR REPLACE FUNCTION update_call_status_on_analysis()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE calls_schema.calls
    SET status = 'completed'
    WHERE id = NEW.call_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analysis_completed_update_status
    AFTER INSERT ON calls_schema.analysis_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_call_status_on_analysis();

-- =============================================
-- Analytics Views
-- =============================================

CREATE OR REPLACE VIEW calls_schema.v_calls_with_analysis AS
SELECT
    c.id,
    c.company_id,
    c.manager_id,
    c.manager_name,
    c.client_phone,
    c.duration,
    c.call_date,
    c.call_time,
    c.status,
    ar.quality_score,
    ar.script_match,
    ar.errors_free,
    ar.overall_rating,
    ar.kpi,
    ar.brief,
    ar.recommendation,
    ar.next_best_action
FROM calls_schema.calls c
LEFT JOIN calls_schema.analysis_reports ar ON c.id = ar.call_id;
