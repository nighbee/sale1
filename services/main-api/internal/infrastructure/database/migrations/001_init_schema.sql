-- =============================================
-- Migration 001: Initialize Database Schema
-- Description: Create all schemas and base tables
-- Author: SalesAI Team
-- Date: 2026-02-08
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- Create Schemas
-- =============================================

CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS scripts_schema;
CREATE SCHEMA IF NOT EXISTS integrations_schema;
CREATE SCHEMA IF NOT EXISTS calls_schema;
CREATE SCHEMA IF NOT EXISTS logs_schema;

-- =============================================
-- SCHEMA: auth_schema
-- =============================================

CREATE TABLE auth_schema.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    stt_model_preference VARCHAR(50) DEFAULT 'whisperx_local'
        CHECK (stt_model_preference IN ('whisperx_local', 'openai', 'gemini')),
    llm_provider VARCHAR(50) DEFAULT 'openai'
        CHECK (llm_provider IN ('openai', 'gemini')),
    subscription_tier VARCHAR(50) DEFAULT 'basic'
        CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================

CREATE TABLE auth_schema.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
        CHECK (role IN ('super_admin', 'tenant_admin', 'sales_rep')),
    manager_id VARCHAR(50),
    manager_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SCHEMA: scripts_schema
-- =============================================

CREATE TABLE scripts_schema.scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path_minio VARCHAR(500) NOT NULL,
    parsed_text TEXT NOT NULL,
    file_type VARCHAR(10) CHECK (file_type IN ('docx', 'pdf')),
    file_size_bytes INT,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SCHEMA: integrations_schema
-- =============================================

CREATE TABLE integrations_schema.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL
        CHECK (integration_type IN ('amocrm', 'google_sheets', 'telegram')),
    credentials JSONB NOT NULL,
    config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_id, integration_type)
);

-- =============================================
-- SCHEMA: calls_schema
-- =============================================

CREATE TABLE calls_schema.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    manager_id VARCHAR(50) NOT NULL,
    manager_name VARCHAR(255),
    client_phone VARCHAR(50) NOT NULL,
    client_id VARCHAR(50),
    duration INT NOT NULL CHECK (duration > 0),
    call_link VARCHAR(500) NOT NULL,
    chat_link VARCHAR(500),
    call_date DATE NOT NULL,
    call_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    source VARCHAR(50) DEFAULT 'webhook'
        CHECK (source IN ('webhook', 'google_sheets', 'manual')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================

CREATE TABLE calls_schema.transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID UNIQUE NOT NULL REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    speaker_diarized_json JSONB NOT NULL,
    stt_provider VARCHAR(50) NOT NULL
        CHECK (stt_provider IN ('whisperx_local', 'openai', 'gemini')),
    processing_time_seconds INT,
    word_count INT,
    processed_at TIMESTAMP DEFAULT NOW()
);

-- =============================================

CREATE TABLE calls_schema.analysis_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID UNIQUE NOT NULL REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    script_id UUID REFERENCES scripts_schema.scripts(id),

    quality_score INT CHECK (quality_score >= 0 AND quality_score <= 100),
    script_match INT CHECK (script_match >= 0 AND script_match <= 100),
    errors_free INT CHECK (errors_free >= 0 AND errors_free <= 100),

    overall_rating DECIMAL(5,2),
    kpi DECIMAL(10,2),

    recommendation TEXT,
    brief TEXT,
    next_best_action TEXT,

    llm_provider VARCHAR(50) CHECK (llm_provider IN ('openai', 'gemini')),
    llm_model VARCHAR(100),
    tokens_used INT,
    processing_time_seconds INT,
    processed_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SCHEMA: logs_schema
-- =============================================

CREATE TABLE logs_schema.processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
    error_message TEXT,
    error_code VARCHAR(100),
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================

CREATE TABLE logs_schema.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'telegram', 'in_app')),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Create updated_at trigger function
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON auth_schema.companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth_schema.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts_schema.scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations_schema.integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls_schema.calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
