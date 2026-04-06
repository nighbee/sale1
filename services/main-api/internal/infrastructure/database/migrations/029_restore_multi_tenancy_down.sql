-- =============================================
-- Migration 029: Restore Multi-Tenancy (DOWN)
-- Description: Drop company-related columns and revert to singleton setup
-- Date: 2026-03-01
-- =============================================

-- 1. Drop dependent views first
DROP VIEW IF EXISTS calls_schema.v_manager_performance;
DROP VIEW IF EXISTS calls_schema.v_calls_with_analysis;

-- 2. Drop constraints and indexes
ALTER TABLE auth_schema.users DROP CONSTRAINT IF EXISTS fk_users_company;
ALTER TABLE auth_schema.teams DROP CONSTRAINT IF EXISTS fk_teams_company;
ALTER TABLE scripts_schema.scripts DROP CONSTRAINT IF EXISTS fk_scripts_company;
ALTER TABLE integrations_schema.integrations DROP CONSTRAINT IF EXISTS fk_integrations_company;
ALTER TABLE calls_schema.calls DROP CONSTRAINT IF EXISTS fk_calls_company;
ALTER TABLE calls_schema.ai_settings DROP CONSTRAINT IF EXISTS fk_ai_settings_company;

ALTER TABLE integrations_schema.integrations DROP CONSTRAINT IF EXISTS integrations_company_id_integration_type_key;
ALTER TABLE integrations_schema.integrations ADD CONSTRAINT integrations_integration_type_unique UNIQUE(integration_type);

DROP INDEX IF EXISTS calls_schema.idx_calls_company;
DROP INDEX IF EXISTS auth_schema.idx_users_company;

-- 3. Drop company_id columns from all tables
ALTER TABLE auth_schema.users DROP COLUMN IF EXISTS company_id;
ALTER TABLE auth_schema.teams DROP COLUMN IF EXISTS company_id;
ALTER TABLE scripts_schema.scripts DROP COLUMN IF EXISTS company_id;
ALTER TABLE integrations_schema.integrations DROP COLUMN IF EXISTS company_id;
ALTER TABLE auth_schema.billing_info DROP COLUMN IF EXISTS company_id;
ALTER TABLE calls_schema.calls DROP COLUMN IF EXISTS company_id;
ALTER TABLE calls_schema.ai_settings DROP COLUMN IF EXISTS company_id;

-- 4. Restore singleton primary key to billing_info (if desired)
ALTER TABLE auth_schema.billing_info ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT uuid_generate_v4();

-- 5. Re-create views without company_id
CREATE OR REPLACE VIEW calls_schema.v_calls_with_analysis AS
SELECT
    c.id,
    c.manager_id,
    c.manager_name,
    c.client_phone,
    c.duration,
    c.call_link,
    c.storage_link,
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

-- 6. Drop the companies table
DROP TABLE IF EXISTS auth_schema.companies CASCADE;
