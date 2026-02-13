-- =============================================
-- Migration 007: Add Manager Performance View
-- Description: Aggregate performance metrics per manager
-- Date: 2026-02-13
-- =============================================

CREATE OR REPLACE VIEW calls_schema.v_manager_performance AS
SELECT
    company_id,
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
GROUP BY company_id, manager_id, manager_name;
