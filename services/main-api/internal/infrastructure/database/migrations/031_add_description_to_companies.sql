-- Migration 031: Add description to companies
-- Description: Restore the description column to auth_schema.companies that was missing in migration 029

ALTER TABLE auth_schema.companies ADD COLUMN IF NOT EXISTS description TEXT;
