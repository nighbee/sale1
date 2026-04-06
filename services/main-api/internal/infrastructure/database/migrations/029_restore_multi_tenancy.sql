-- =============================================
-- Migration 029: Restore Multi-Tenancy (UP)
-- Description: Recreate companies table and restore company_id to all entities
-- Date: 2026-03-01
-- =============================================

-- Step A: Restore auth_schema.companies table
CREATE TABLE IF NOT EXISTS auth_schema.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    stt_model_preference VARCHAR(50) DEFAULT 'whisperx_local'
        CHECK (stt_model_preference IN ('whisperx_local', 'openai', 'gemini')),
    llm_provider VARCHAR(50) DEFAULT 'openai'
        CHECK (llm_provider IN ('openai', 'gemini')),
    subscription_tier VARCHAR(50) DEFAULT 'basic'
        CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT TRUE,
    industry TEXT,
    size TEXT,
    time_zone TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Re-apply trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at') THEN
        CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON auth_schema.companies
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Step B: Create a default company for backfilling
INSERT INTO auth_schema.companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Company')
ON CONFLICT (id) DO NOTHING;

-- Step C: Restore company_id column to affected tables

-- 1. auth_schema.users
ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE auth_schema.users SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE auth_schema.users ALTER COLUMN company_id SET NOT NULL;

-- 2. auth_schema.teams
ALTER TABLE auth_schema.teams ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE auth_schema.teams SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE auth_schema.teams ALTER COLUMN company_id SET NOT NULL;

-- 3. scripts_schema.scripts
ALTER TABLE scripts_schema.scripts ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE scripts_schema.scripts SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE scripts_schema.scripts ALTER COLUMN company_id SET NOT NULL;

-- 4. integrations_schema.integrations
ALTER TABLE integrations_schema.integrations ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE integrations_schema.integrations SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE integrations_schema.integrations ALTER COLUMN company_id SET NOT NULL;

-- 5. calls_schema.calls
ALTER TABLE calls_schema.calls ADD COLUMN IF NOT EXISTS company_id UUID;
-- Try to backfill from users via manager_id (which exists on both tables and refers to the external ID)
UPDATE calls_schema.calls c
SET company_id = u.company_id
FROM auth_schema.users u
WHERE c.manager_id = u.manager_id AND c.company_id IS NULL;
-- Fallback for remaining
UPDATE calls_schema.calls SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE calls_schema.calls ALTER COLUMN company_id SET NOT NULL;

-- 6. calls_schema.ai_settings
ALTER TABLE calls_schema.ai_settings ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE calls_schema.ai_settings SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE calls_schema.ai_settings ALTER COLUMN company_id SET NOT NULL;

-- 7. auth_schema.billing_info
ALTER TABLE auth_schema.billing_info ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE auth_schema.billing_info SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
-- Handle the temporary 'id' column added in migration 017
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth_schema' AND table_name = 'billing_info' AND column_name = 'id') THEN
        ALTER TABLE auth_schema.billing_info DROP CONSTRAINT IF EXISTS billing_info_pkey CASCADE;
        ALTER TABLE auth_schema.billing_info DROP COLUMN IF EXISTS id;
        ALTER TABLE auth_schema.billing_info ADD PRIMARY KEY (company_id);
    END IF;
END $$;


-- Step D: Restore constraints and indexes

-- Foreign Keys
ALTER TABLE auth_schema.users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES auth_schema.companies(id) ON DELETE CASCADE;
ALTER TABLE auth_schema.teams ADD CONSTRAINT fk_teams_company FOREIGN KEY (company_id) REFERENCES auth_schema.companies(id) ON DELETE CASCADE;
ALTER TABLE scripts_schema.scripts ADD CONSTRAINT fk_scripts_company FOREIGN KEY (company_id) REFERENCES auth_schema.companies(id) ON DELETE CASCADE;
ALTER TABLE integrations_schema.integrations ADD CONSTRAINT fk_integrations_company FOREIGN KEY (company_id) REFERENCES auth_schema.companies(id) ON DELETE CASCADE;
ALTER TABLE calls_schema.calls ADD CONSTRAINT fk_calls_company FOREIGN KEY (company_id) REFERENCES auth_schema.companies(id) ON DELETE CASCADE;
ALTER TABLE calls_schema.ai_settings ADD CONSTRAINT fk_ai_settings_company FOREIGN KEY (company_id) REFERENCES auth_schema.companies(id) ON DELETE CASCADE;

-- Unique constraints
ALTER TABLE integrations_schema.integrations DROP CONSTRAINT IF EXISTS integrations_integration_type_unique;
ALTER TABLE integrations_schema.integrations ADD CONSTRAINT integrations_company_id_integration_type_key UNIQUE(company_id, integration_type);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calls_company ON calls_schema.calls(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company ON auth_schema.users(company_id);


-- Step E: Restore views
-- First drop existing views to allow column changes
DROP VIEW IF EXISTS calls_schema.v_manager_performance CASCADE;
DROP VIEW IF EXISTS calls_schema.v_calls_with_analysis CASCADE;

-- 1. v_calls_with_analysis
CREATE VIEW calls_schema.v_calls_with_analysis AS
SELECT
    c.id,
    c.company_id,
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

-- 2. v_manager_performance
CREATE VIEW calls_schema.v_manager_performance AS
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
