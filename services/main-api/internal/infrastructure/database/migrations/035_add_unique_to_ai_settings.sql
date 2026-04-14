-- =============================================
-- Migration 035: Add Unique Constraint to AI Settings
-- Description: Add UNIQUE(company_id) to calls_schema.ai_settings to support ON CONFLICT
-- Date: 2026-04-14
-- =============================================

ALTER TABLE calls_schema.ai_settings ADD CONSTRAINT ai_settings_company_id_key UNIQUE (company_id);
