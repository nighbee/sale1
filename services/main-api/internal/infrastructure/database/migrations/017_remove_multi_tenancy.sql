-- Migration 017: Remove company_id and related tables
-- Description: Drop company-related columns and tables for a single-company setup

-- 1. Drop company-related tables first
DROP TABLE IF EXISTS auth_schema.user_companies CASCADE;
DROP TABLE IF EXISTS auth_schema.companies CASCADE;

-- 2. Drop company_id columns from all tables
ALTER TABLE auth_schema.users DROP COLUMN IF EXISTS company_id;
ALTER TABLE auth_schema.teams DROP COLUMN IF EXISTS company_id;
ALTER TABLE scripts_schema.scripts DROP COLUMN IF EXISTS company_id;
ALTER TABLE integrations_schema.integrations DROP COLUMN IF EXISTS company_id;
ALTER TABLE auth_schema.billing_info DROP COLUMN IF EXISTS company_id;
ALTER TABLE calls_schema.calls DROP COLUMN IF EXISTS company_id;

-- 3. Add a singleton primary key to billing_info (if it was company_id)
-- Or just treat it as a global settings table
ALTER TABLE auth_schema.billing_info ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT uuid_generate_v4();

-- 4. Update unique constraints in integrations_schema.integrations
-- Previous constraint was UNIQUE(company_id, integration_type)
ALTER TABLE integrations_schema.integrations DROP CONSTRAINT IF EXISTS integrations_company_id_integration_type_key;
ALTER TABLE integrations_schema.integrations ADD CONSTRAINT integrations_integration_type_unique UNIQUE(integration_type);

-- 5. Remove any other references or triggers that depended on companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON auth_schema.companies;
