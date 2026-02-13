-- =============================================
-- Migration 005: Add structure column to scripts
-- Description: Add JSONB column for structured script data
-- Date: 2026-02-08
-- =============================================

ALTER TABLE scripts_schema.scripts ADD COLUMN IF NOT EXISTS structure JSONB;
