-- Migration 010: Enhance Schema for Multiple Companies, Teams and Scripts
-- Description: Add user_companies, update companies, users, scripts and add billing_info

-- Add first_name and last_name to users
ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- Create user_companies table for many-to-many relationship
CREATE TABLE IF NOT EXISTS auth_schema.user_companies (
    user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'tenant_admin', 'sales_rep')),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, company_id)
);

-- Migrate existing users to user_companies
INSERT INTO auth_schema.user_companies (user_id, company_id, role)
SELECT id, company_id, role FROM auth_schema.users
ON CONFLICT DO NOTHING;

-- Keep company_id in users as "current" or "default" company, but make it nullable
ALTER TABLE auth_schema.users ALTER COLUMN company_id DROP NOT NULL;

-- Add description to companies
ALTER TABLE auth_schema.companies ADD COLUMN IF NOT EXISTS description TEXT;

-- Add team_id to scripts
ALTER TABLE scripts_schema.scripts ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES auth_schema.teams(id) ON DELETE CASCADE;

-- Update integrations_type check to include slack
ALTER TABLE integrations_schema.integrations DROP CONSTRAINT IF EXISTS integrations_integration_type_check;
ALTER TABLE integrations_schema.integrations ADD CONSTRAINT integrations_integration_type_check
    CHECK (integration_type IN ('amocrm', 'google_sheets', 'telegram', 'slack'));

-- Create billing_info table
CREATE TABLE IF NOT EXISTS auth_schema.billing_info (
    company_id UUID PRIMARY KEY REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    card_holder_name VARCHAR(255),
    card_number_masked VARCHAR(20),
    expiration_date VARCHAR(10),
    card_type VARCHAR(50),
    tokens_used INT DEFAULT 0,
    tokens_limit INT DEFAULT 100000,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Apply trigger to billing_info
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_billing_info_updated_at') THEN
        CREATE TRIGGER update_billing_info_updated_at BEFORE UPDATE ON auth_schema.billing_info
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
