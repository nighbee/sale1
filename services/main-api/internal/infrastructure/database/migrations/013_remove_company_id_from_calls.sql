-- =============================================
-- Migration 013: Remove company_id from calls
-- Description: Drop company_id column and update views/indexes
-- Date: 2026-02-24
-- =============================================

-- Drop dependent views first
DROP VIEW IF EXISTS calls_schema.v_manager_performance;
DROP VIEW IF EXISTS calls_schema.v_calls_with_analysis;

-- Drop indexes that use company_id
DROP INDEX IF EXISTS calls_schema.idx_calls_company;
DROP INDEX IF EXISTS calls_schema.idx_calls_company_manager;
DROP INDEX IF EXISTS calls_schema.idx_calls_company_status;
DROP INDEX IF EXISTS calls_schema.idx_calls_company_date;

-- Drop the column from calls table
ALTER TABLE calls_schema.calls DROP COLUMN IF EXISTS company_id;

-- Re-create v_calls_with_analysis without company_id
CREATE OR REPLACE VIEW calls_schema.v_calls_with_analysis AS
SELECT
    c.id,
    c.manager_id,
    c.manager_name,
    c.client_phone,
    c.duration,
    c.call_date,
    c.call_time,
    c.status,
    c.source,
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

-- Re-create v_manager_performance without company_id
CREATE OR REPLACE VIEW calls_schema.v_manager_performance AS
SELECT
    manager_id,
    manager_name,
    COUNT(id) as total_calls,
    AVG(quality_score) as avg_quality,
    AVG(script_match) as avg_script_match,
    AVG(errors_free) as avg_errors_free,
    AVG(overall_rating) as avg_overall_rating,
    AVG(kpi) as avg_kpi,
    SUM(duration) as total_duration_seconds
FROM calls_schema.v_calls_with_analysis
GROUP BY manager_id, manager_name;

-- Create new indexes without company_id for performance
CREATE INDEX IF NOT EXISTS idx_calls_manager ON calls_schema.calls(manager_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls_schema.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_date ON calls_schema.calls(call_date DESC);
