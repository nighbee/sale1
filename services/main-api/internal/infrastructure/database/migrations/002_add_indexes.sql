-- =============================================
-- Migration 002: Add Performance Indexes
-- Description: Optimize query performance
-- Author: SalesAI Team
-- Date: 2026-02-08
-- =============================================

-- =============================================
-- auth_schema indexes
-- =============================================

CREATE INDEX idx_users_company ON auth_schema.users(company_id);
CREATE INDEX idx_users_manager ON auth_schema.users(manager_id);
CREATE INDEX idx_users_email_lower ON auth_schema.users(LOWER(email));
CREATE INDEX idx_users_active ON auth_schema.users(is_active) WHERE is_active = TRUE;

-- =============================================
-- scripts_schema indexes
-- =============================================

CREATE INDEX idx_scripts_company ON scripts_schema.scripts(company_id);
CREATE INDEX idx_scripts_active ON scripts_schema.scripts(company_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_scripts_created ON scripts_schema.scripts(created_at DESC);

-- =============================================
-- integrations_schema indexes
-- =============================================

CREATE INDEX idx_integrations_company ON integrations_schema.integrations(company_id);
CREATE INDEX idx_integrations_type ON integrations_schema.integrations(integration_type);
CREATE INDEX idx_integrations_active ON integrations_schema.integrations(company_id, integration_type) WHERE is_active = TRUE;

-- =============================================
-- calls_schema indexes
-- =============================================

CREATE INDEX idx_calls_company ON calls_schema.calls(company_id);
CREATE INDEX idx_calls_manager ON calls_schema.calls(manager_id);
CREATE INDEX idx_calls_status ON calls_schema.calls(status);
CREATE INDEX idx_calls_date ON calls_schema.calls(call_date DESC);
CREATE INDEX idx_calls_created ON calls_schema.calls(created_at DESC);

CREATE INDEX idx_calls_company_manager ON calls_schema.calls(company_id, manager_id);
CREATE INDEX idx_calls_company_status ON calls_schema.calls(company_id, status);
CREATE INDEX idx_calls_company_date ON calls_schema.calls(company_id, call_date DESC);
CREATE INDEX idx_calls_date_range ON calls_schema.calls(call_date, call_time);

CREATE INDEX idx_calls_pending ON calls_schema.calls(created_at) WHERE status = 'pending';

-- =============================================
-- Transcripts indexes
-- =============================================

CREATE INDEX idx_transcripts_call ON calls_schema.transcripts(call_id);
CREATE INDEX idx_transcripts_provider ON calls_schema.transcripts(stt_provider);
CREATE INDEX idx_transcripts_processed ON calls_schema.transcripts(processed_at DESC);

-- =============================================
-- Analysis reports indexes
-- =============================================

CREATE INDEX idx_analysis_call ON calls_schema.analysis_reports(call_id);
CREATE INDEX idx_analysis_script ON calls_schema.analysis_reports(script_id);
CREATE INDEX idx_analysis_quality ON calls_schema.analysis_reports(quality_score DESC);
CREATE INDEX idx_analysis_kpi ON calls_schema.analysis_reports(kpi DESC);
CREATE INDEX idx_analysis_processed ON calls_schema.analysis_reports(processed_at DESC);

CREATE INDEX idx_analysis_quality_kpi ON calls_schema.analysis_reports(overall_rating DESC, kpi DESC);
