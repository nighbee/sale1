-- Migration 032: Add managers_count to companies
-- Description: Add managers_count column to auth_schema.companies to track the number of managers in the organization

ALTER TABLE auth_schema.companies ADD COLUMN IF NOT EXISTS managers_count INT DEFAULT 0;
