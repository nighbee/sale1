# SalesAI - Database Migrations & Seed Data

**Version:** 1.0  
**Date:** February 2026

---

## Migration Strategy

Migrations are versioned SQL files executed in order:

- `001_init_schema.sql` - Create schemas and tables
- `002_add_indexes.sql` - Performance indexes
- `003_add_constraints.sql` - Foreign keys and checks
- `004_seed_data.sql` - Initial test data

---

## Migration 001: Initialize Schema

**File:** `services/main-api/internal/infrastructure/database/migrations/001_init_schema.sql`

```sql
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

COMMENT ON TABLE auth_schema.companies IS 'Tenant companies using the platform';
COMMENT ON COLUMN auth_schema.companies.stt_model_preference IS 'Preferred STT provider: whisperx_local, openai, or gemini';
COMMENT ON COLUMN auth_schema.companies.llm_provider IS 'LLM provider for analysis: openai or gemini';

-- =============================================

CREATE TABLE auth_schema.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
        CHECK (role IN ('super_admin', 'tenant_admin', 'sales_rep')),
    manager_id VARCHAR(50), -- Maps to CRM manager ID (e.g., "222")
    manager_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE auth_schema.users IS 'Platform users with role-based access';
COMMENT ON COLUMN auth_schema.users.role IS 'User role: super_admin (platform owner), tenant_admin (company admin), sales_rep (individual rep)';
COMMENT ON COLUMN auth_schema.users.manager_id IS 'External CRM manager identifier';

-- =============================================
-- SCHEMA: scripts_schema
-- =============================================

CREATE TABLE scripts_schema.scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path_minio VARCHAR(500) NOT NULL, -- MinIO object key
    parsed_text TEXT NOT NULL, -- Extracted text from DOCX/PDF
    file_type VARCHAR(10) CHECK (file_type IN ('docx', 'pdf')),
    file_size_bytes INT,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE scripts_schema.scripts IS 'Sales scripts uploaded by admins';
COMMENT ON COLUMN scripts_schema.scripts.parsed_text IS 'Plain text extracted from uploaded document';

-- =============================================
-- SCHEMA: integrations_schema
-- =============================================

CREATE TABLE integrations_schema.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL
        CHECK (integration_type IN ('amocrm', 'google_sheets', 'telegram')),
    credentials JSONB NOT NULL, -- OAuth tokens, API keys
    config JSONB, -- Additional settings (e.g., sheet_id, bot_token)
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_id, integration_type)
);

COMMENT ON TABLE integrations_schema.integrations IS 'External integrations (CRM, Sheets, Notifications)';
COMMENT ON COLUMN integrations_schema.integrations.credentials IS 'Encrypted credentials stored as JSON';

-- =============================================
-- SCHEMA: calls_schema
-- =============================================

CREATE TABLE calls_schema.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    manager_id VARCHAR(50) NOT NULL, -- External manager ID (e.g., "222")
    manager_name VARCHAR(255),
    client_phone VARCHAR(50) NOT NULL,
    client_id VARCHAR(50), -- CRM client ID
    duration INT NOT NULL CHECK (duration > 0), -- seconds
    call_link VARCHAR(500) NOT NULL, -- URL to audio file
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

COMMENT ON TABLE calls_schema.calls IS 'Call records from CRM or Google Sheets';
COMMENT ON COLUMN calls_schema.calls.status IS 'Processing status: pending → processing → completed/error';
COMMENT ON COLUMN calls_schema.calls.source IS 'How the call was ingested';

-- =============================================

CREATE TABLE calls_schema.transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID UNIQUE NOT NULL REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    speaker_diarized_json JSONB NOT NULL, -- Array of {start, end, speaker, text}
    stt_provider VARCHAR(50) NOT NULL
        CHECK (stt_provider IN ('whisperx_local', 'openai', 'gemini')),
    processing_time_seconds INT,
    word_count INT,
    processed_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE calls_schema.transcripts IS 'Speech-to-text transcripts with speaker diarization';
COMMENT ON COLUMN calls_schema.transcripts.speaker_diarized_json IS 'JSON array of transcript segments with timestamps';

-- =============================================

CREATE TABLE calls_schema.analysis_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID UNIQUE NOT NULL REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    script_id UUID REFERENCES scripts_schema.scripts(id),

    -- Metrics (0-100)
    quality_score INT CHECK (quality_score >= 0 AND quality_score <= 100),
    script_match INT CHECK (script_match >= 0 AND script_match <= 100),
    errors_free INT CHECK (errors_free >= 0 AND errors_free <= 100),

    -- Calculated values
    overall_rating DECIMAL(5,2),
    kpi DECIMAL(10,2),

    -- AI-generated insights
    recommendation TEXT,
    brief TEXT,
    next_best_action TEXT,

    -- Metadata
    llm_provider VARCHAR(50) CHECK (llm_provider IN ('openai', 'gemini')),
    llm_model VARCHAR(100), -- e.g., "gpt-4-turbo"
    tokens_used INT,
    processing_time_seconds INT,
    processed_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE calls_schema.analysis_reports IS 'AI-generated analysis results for each call';
COMMENT ON COLUMN calls_schema.analysis_reports.kpi IS 'Calculated KPI = (quality*0.4 + script_match*0.4 + errors_free*0.2) * (duration/60)';

-- =============================================
-- SCHEMA: logs_schema
-- =============================================

CREATE TABLE logs_schema.processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL, -- 'stt_service', 'ai_analytics', etc.
    status VARCHAR(50) NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
    error_message TEXT,
    error_code VARCHAR(100),
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_processing_logs_call ON logs_schema.processing_logs(call_id);
CREATE INDEX idx_processing_logs_status ON logs_schema.processing_logs(status);
CREATE INDEX idx_processing_logs_service ON logs_schema.processing_logs(service_name);

COMMENT ON TABLE logs_schema.processing_logs IS 'Processing logs for debugging and retry tracking';

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

CREATE INDEX idx_notifications_user ON logs_schema.notifications(user_id);
CREATE INDEX idx_notifications_unread ON logs_schema.notifications(user_id, is_read) WHERE is_read = FALSE;

COMMENT ON TABLE logs_schema.notifications IS 'User notifications for important events';

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

-- =============================================
-- Migration complete
-- =============================================

COMMENT ON SCHEMA auth_schema IS 'Authentication and authorization data';
COMMENT ON SCHEMA scripts_schema IS 'Sales scripts and templates';
COMMENT ON SCHEMA integrations_schema IS 'External service integrations';
COMMENT ON SCHEMA calls_schema IS 'Call records, transcripts, and analysis';
COMMENT ON SCHEMA logs_schema IS 'System logs and notifications';
```

---

## Migration 002: Add Performance Indexes

**File:** `002_add_indexes.sql`

```sql
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

-- Primary query patterns
CREATE INDEX idx_calls_company ON calls_schema.calls(company_id);
CREATE INDEX idx_calls_manager ON calls_schema.calls(manager_id);
CREATE INDEX idx_calls_status ON calls_schema.calls(status);
CREATE INDEX idx_calls_date ON calls_schema.calls(call_date DESC);
CREATE INDEX idx_calls_created ON calls_schema.calls(created_at DESC);

-- Composite indexes for common filters
CREATE INDEX idx_calls_company_manager ON calls_schema.calls(company_id, manager_id);
CREATE INDEX idx_calls_company_status ON calls_schema.calls(company_id, status);
CREATE INDEX idx_calls_company_date ON calls_schema.calls(company_id, call_date DESC);
CREATE INDEX idx_calls_date_range ON calls_schema.calls(call_date, call_time);

-- For pending calls queue
CREATE INDEX idx_calls_pending ON calls_schema.calls(created_at) WHERE status = 'pending';

-- =============================================
-- Transcripts indexes
-- =============================================

CREATE INDEX idx_transcripts_call ON calls_schema.transcripts(call_id);
CREATE INDEX idx_transcripts_provider ON calls_schema.transcripts(stt_provider);
CREATE INDEX idx_transcripts_processed ON calls_schema.transcripts(processed_at DESC);

-- For JSON queries (if needed)
CREATE INDEX idx_transcripts_segments ON calls_schema.transcripts USING GIN (speaker_diarized_json);

-- =============================================
-- Analysis reports indexes
-- =============================================

CREATE INDEX idx_analysis_call ON calls_schema.analysis_reports(call_id);
CREATE INDEX idx_analysis_script ON calls_schema.analysis_reports(script_id);
CREATE INDEX idx_analysis_quality ON calls_schema.analysis_reports(quality_score DESC);
CREATE INDEX idx_analysis_kpi ON calls_schema.analysis_reports(kpi DESC);
CREATE INDEX idx_analysis_processed ON calls_schema.analysis_reports(processed_at DESC);

-- Composite for leaderboard queries
CREATE INDEX idx_analysis_quality_kpi ON calls_schema.analysis_reports(overall_rating DESC, kpi DESC);

-- =============================================
-- Analytics optimization
-- =============================================

-- For team performance queries
CREATE INDEX idx_calls_analytics ON calls_schema.calls(company_id, call_date, status)
    WHERE status = 'completed';

-- For aggregations
CREATE INDEX idx_calls_manager_date ON calls_schema.calls(manager_id, call_date)
    WHERE status = 'completed';

-- =============================================
-- Full-text search (optional, for future)
-- =============================================

-- ALTER TABLE calls_schema.transcripts ADD COLUMN transcript_text_search tsvector;
-- CREATE INDEX idx_transcript_fts ON calls_schema.transcripts USING GIN(transcript_text_search);

COMMENT ON INDEX idx_calls_company_manager IS 'Optimizes manager-specific call queries';
COMMENT ON INDEX idx_calls_pending IS 'Optimizes job queue processing';
```

---

## Migration 003: Add Constraints & Views

**File:** `003_add_constraints.sql`

```sql
-- =============================================
-- Migration 003: Add Constraints and Views
-- Description: Business logic constraints and analytics views
-- Author: SalesAI Team
-- Date: 2026-02-08
-- =============================================

-- =============================================
-- Business Logic Constraints
-- =============================================

-- Ensure at least one admin per company
CREATE OR REPLACE FUNCTION check_company_has_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'tenant_admin' AND NEW.role != 'tenant_admin' THEN
        IF (SELECT COUNT(*) FROM auth_schema.users
            WHERE company_id = OLD.company_id
            AND role = 'tenant_admin'
            AND id != OLD.id) = 0 THEN
            RAISE EXCEPTION 'Cannot remove last admin from company';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_company_has_admin
    BEFORE UPDATE ON auth_schema.users
    FOR EACH ROW
    EXECUTE FUNCTION check_company_has_admin();

-- =============================================
-- Automatic status updates
-- =============================================

-- Update call status when transcript is created
CREATE OR REPLACE FUNCTION update_call_status_on_transcript()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE calls_schema.calls
    SET status = 'processing'
    WHERE id = NEW.call_id AND status = 'pending';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_created_update_status
    AFTER INSERT ON calls_schema.transcripts
    FOR EACH ROW
    EXECUTE FUNCTION update_call_status_on_transcript();

-- =============================================

-- Update call status when analysis is completed
CREATE OR REPLACE FUNCTION update_call_status_on_analysis()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE calls_schema.calls
    SET status = 'completed'
    WHERE id = NEW.call_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analysis_completed_update_status
    AFTER INSERT ON calls_schema.analysis_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_call_status_on_analysis();

-- =============================================
-- Analytics Views
-- =============================================

CREATE OR REPLACE VIEW calls_schema.v_calls_with_analysis AS
SELECT
    c.id,
    c.company_id,
    c.manager_id,
    c.manager_name,
    c.client_phone,
    c.duration,
    c.call_date,
    c.call_time,
    c.status,
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

COMMENT ON VIEW calls_schema.v_calls_with_analysis IS 'Joined view of calls and their analysis for easy querying';

-- =============================================

CREATE OR REPLACE VIEW calls_schema.v_manager_performance AS
SELECT
    c.company_id,
    c.manager_id,
    c.manager_name,
    COUNT(c.id) as total_calls,
    AVG(ar.quality_score) as avg_quality,
    AVG(ar.script_match) as avg_script_match,
    AVG(ar.errors_free) as avg_errors_free,
    AVG(ar.overall_rating) as avg_overall_rating,
    AVG(ar.kpi) as avg_kpi,
    SUM(c.duration) as total_duration_seconds,
    MIN(c.call_date) as first_call_date,
    MAX(c.call_date) as last_call_date
FROM calls_schema.calls c
INNER JOIN calls_schema.analysis_reports ar ON c.id = ar.call_id
WHERE c.status = 'completed'
GROUP BY c.company_id, c.manager_id, c.manager_name;

COMMENT ON VIEW calls_schema.v_manager_performance IS 'Aggregated performance metrics per manager';

-- =============================================

CREATE OR REPLACE VIEW logs_schema.v_failed_calls AS
SELECT
    c.id as call_id,
    c.company_id,
    c.manager_id,
    c.manager_name,
    c.call_date,
    c.created_at,
    pl.service_name,
    pl.error_message,
    pl.retry_count
FROM calls_schema.calls c
INNER JOIN logs_schema.processing_logs pl ON c.id = pl.call_id
WHERE c.status = 'error'
ORDER BY c.created_at DESC;

COMMENT ON VIEW logs_schema.v_failed_calls IS 'Quick access to failed calls for debugging';

-- =============================================
-- Data validation functions
-- =============================================

CREATE OR REPLACE FUNCTION validate_phone_number(phone VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN phone ~ '^[0-9]{10,15}$';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_manager_id(manager_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN manager_id ~ '^[0-9]{1,10}$';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Cleanup functions
-- =============================================

-- Delete old processing logs (> 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM logs_schema.processing_logs
    WHERE created_at < NOW() - INTERVAL '90 days';

    DELETE FROM logs_schema.notifications
    WHERE sent_at < NOW() - INTERVAL '90 days' AND is_read = TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_logs IS 'Run monthly to clean up old logs';
```

---

## Migration 004: Seed Data (Development/Test)

**File:** `004_seed_data.sql`

```sql
-- =============================================
-- Migration 004: Seed Data for Development
-- Description: Insert test data for local development
-- Author: SalesAI Team
-- Date: 2026-02-08
-- WARNING: DO NOT RUN IN PRODUCTION
-- =============================================

-- =============================================
-- Create Test Company
-- =============================================

INSERT INTO auth_schema.companies (id, name, stt_model_preference, llm_provider, subscription_tier)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Test Company', 'whisperx_local', 'openai', 'pro');

-- =============================================
-- Create Test Users
-- Password for all: "Test1234" (bcrypt hash)
-- =============================================

INSERT INTO auth_schema.users (id, company_id, email, password_hash, role, manager_id, manager_name)
VALUES
    -- Admin
    ('660e8400-e29b-41d4-a716-446655440001',
     '550e8400-e29b-41d4-a716-446655440000',
     'admin@test.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMy.ez09jLGO5RzR5CZY5/VRX5f.6zzGKLe', -- Test1234
     'tenant_admin',
     '001',
     'Test Admin'),

    -- Sales Rep 1
    ('660e8400-e29b-41d4-a716-446655440002',
     '550e8400-e29b-41d4-a716-446655440000',
     'anzhelika@test.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMy.ez09jLGO5RzR5CZY5/VRX5f.6zzGKLe',
     'sales_rep',
     '222',
     'Anzhelika'),

    -- Sales Rep 2
    ('660e8400-e29b-41d4-a716-446655440003',
     '550e8400-e29b-41d4-a716-446655440000',
     'darina@test.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMy.ez09jLGO5RzR5CZY5/VRX5f.6zzGKLe',
     'sales_rep',
     '111',
     'Darina');

-- =============================================
-- Create Test Script
-- =============================================

INSERT INTO scripts_schema.scripts (id, company_id, name, file_path_minio, parsed_text, file_type, version)
VALUES
    ('770e8400-e29b-41d4-a716-446655440001',
     '550e8400-e29b-41d4-a716-446655440000',
     'Test Sales Script Q1 2026',
     'scripts/770e8400-e29b-41d4-a716-446655440001/script.docx',
     E'# Введение\n\nЗдравствуйте! Меня зовут [ИМЯ] из компании [КОМПАНИЯ].\n\n# Выявление потребностей\n\nРасскажите, чем вы сейчас занимаетесь?\nКакие у вас цели на ближайший год?\n\n# Презентация\n\nНаш продукт помогает...\n\n# Закрытие\n\nГотовы начать?',
     'docx',
     1);

-- =============================================
-- Create Test Calls with Full Pipeline
-- =============================================

-- Call 1: Completed (High Quality)
INSERT INTO calls_schema.calls (id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, call_date, call_time, status)
VALUES
    ('880e8400-e29b-41d4-a716-446655440001',
     '550e8400-e29b-41d4-a716-446655440000',
     '222',
     'Anzhelika',
     '77081996454',
     '33817535',
     1321,
     'https://files.salebot.pro/test/call1.mp3',
     '2026-02-08',
     '10:30:00',
     'completed');

INSERT INTO calls_schema.transcripts (call_id, speaker_diarized_json, stt_provider, processing_time_seconds)
VALUES
    ('880e8400-e29b-41d4-a716-446655440001',
     '[
        {"start": 0.5, "end": 3.2, "speaker": "SPEAKER_0", "text": "Здравствуйте, меня зовут Анжелика"},
        {"start": 3.5, "end": 5.1, "speaker": "SPEAKER_1", "text": "Добрый день"},
        {"start": 5.3, "end": 8.9, "speaker": "SPEAKER_0", "text": "Расскажите, чем вы сейчас занимаетесь?"}
     ]'::jsonb,
     'whisperx_local',
     45);

INSERT INTO calls_schema.analysis_reports (call_id, script_id, quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action, llm_provider)
VALUES
    ('880e8400-e29b-41d4-a716-446655440001',
     '770e8400-e29b-41d4-a716-446655440001',
     90,
     95,
     98,
     94.2,
     16439.1,
     'Отличная работа с выявлением потребностей. Рекомендуется уделить больше времени презентации продукта.',
     'Успешный звонок с клиентом. Выявлены потребности, представлен продукт, достигнута договоренность.',
     'Отправить коммерческое предложение на email клиента',
     'openai');

-- Call 2: Processing
INSERT INTO calls_schema.calls (id, company_id, manager_id, manager_name, client_phone, duration, call_link, call_date, call_time, status)
VALUES
    ('880e8400-e29b-41d4-a716-446655440002',
     '550e8400-e29b-41d4-a716-446655440000',
     '111',
     'Darina',
     '77081996455',
     1500,
     'https://files.salebot.pro/test/call2.mp3',
     '2026-02-08',
     '11:00:00',
     'processing');

-- Call 3: Error
INSERT INTO calls_schema.calls (id, company_id, manager_id, manager_name, client_phone, duration, call_link, call_date, call_time, status)
VALUES
    ('880e8400-e29b-41d4-a716-446655440003',
     '550e8400-e29b-41d4-a716-446655440000',
     '111',
     'Darina',
     '77081996456',
     800,
     'https://files.salebot.pro/test/call3.mp3',
     '2026-02-08',
     '12:00:00',
     'error');

INSERT INTO logs_schema.processing_logs (call_id, service_name, status, error_message, retry_count)
VALUES
    ('880e8400-e29b-41d4-a716-446655440003',
     'stt_service',
     'error',
     'connect ECONNREFUSED 172.19.0.3:5001',
     3);

-- =============================================
-- Create Test Integration
-- =============================================

INSERT INTO integrations_schema.integrations (company_id, integration_type, credentials, config)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000',
     'amocrm',
     '{"api_key": "test_key_123", "domain": "test.amocrm.ru"}'::jsonb,
     '{"webhook_secret": "secret123"}'::jsonb);

-- =============================================
-- Verify Seed Data
-- =============================================

DO $$
DECLARE
    company_count INT;
    user_count INT;
    call_count INT;
BEGIN
    SELECT COUNT(*) INTO company_count FROM auth_schema.companies;
    SELECT COUNT(*) INTO user_count FROM auth_schema.users;
    SELECT COUNT(*) INTO call_count FROM calls_schema.calls;

    RAISE NOTICE 'Seed data created successfully:';
    RAISE NOTICE '  Companies: %', company_count;
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Calls: %', call_count;

    IF company_count = 0 OR user_count = 0 THEN
        RAISE EXCEPTION 'Seed data creation failed';
    END IF;
END $$;
```

---

## Migration Runner (Golang)

**File:** `services/main-api/cmd/migrate/main.go`

```go
package main

import (
    "database/sql"
    "fmt"
    "io/ioutil"
    "log"
    "os"
    "path/filepath"
    "sort"

    _ "github.com/lib/pq"
)

type Migration struct {
    Version  int
    Filename string
    Content  string
}

func main() {
    // Database connection
    connStr := fmt.Sprintf(
        "host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
        os.Getenv("DB_HOST"),
        os.Getenv("DB_PORT"),
        os.Getenv("DB_USER"),
        os.Getenv("DB_PASSWORD"),
        os.Getenv("DB_NAME"),
    )

    db, err := sql.Open("postgres", connStr)
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }
    defer db.Close()

    // Create migrations table
    _, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            executed_at TIMESTAMP DEFAULT NOW()
        )
    `)
    if err != nil {
        log.Fatal("Failed to create migrations table:", err)
    }

    // Load migration files
    migrationsDir := "./internal/infrastructure/database/migrations"
    migrations, err := loadMigrations(migrationsDir)
    if err != nil {
        log.Fatal("Failed to load migrations:", err)
    }

    // Get executed migrations
    executedVersions, err := getExecutedMigrations(db)
    if err != nil {
        log.Fatal("Failed to get executed migrations:", err)
    }

    // Run pending migrations
    for _, migration := range migrations {
        if _, executed := executedVersions[migration.Version]; !executed {
            log.Printf("Running migration %s...", migration.Filename)

            _, err := db.Exec(migration.Content)
            if err != nil {
                log.Fatalf("Migration %s failed: %v", migration.Filename, err)
            }

            _, err = db.Exec(
                "INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)",
                migration.Version,
                migration.Filename,
            )
            if err != nil {
                log.Fatal("Failed to record migration:", err)
            }

            log.Printf("✓ Migration %s completed", migration.Filename)
        }
    }

    log.Println("All migrations completed successfully!")
}

func loadMigrations(dir string) ([]Migration, error) {
    var migrations []Migration

    files, err := ioutil.ReadDir(dir)
    if err != nil {
        return nil, err
    }

    for _, file := range files {
        if filepath.Ext(file.Name()) != ".sql" {
            continue
        }

        content, err := ioutil.ReadFile(filepath.Join(dir, file.Name()))
        if err != nil {
            return nil, err
        }

        var version int
        fmt.Sscanf(file.Name(), "%d_", &version)

        migrations = append(migrations, Migration{
            Version:  version,
            Filename: file.Name(),
            Content:  string(content),
        })
    }

    sort.Slice(migrations, func(i, j int) bool {
        return migrations[i].Version < migrations[j].Version
    })

    return migrations, nil
}

func getExecutedMigrations(db *sql.DB) (map[int]bool, error) {
    rows, err := db.Query("SELECT version FROM schema_migrations")
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    executed := make(map[int]bool)
    for rows.Next() {
        var version int
        if err := rows.Scan(&version); err != nil {
            return nil, err
        }
        executed[version] = true
    }

    return executed, nil
}
```

---

## Usage Instructions

### Run Migrations

```bash
# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=salesai_user
export DB_PASSWORD=your_password
export DB_NAME=salesai

# Run migrations
cd services/main-api
go run cmd/migrate/main.go
```

### Rollback Strategy

For rollback, create reverse migration files:

- `001_down_init_schema.sql`
- `002_down_add_indexes.sql`

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026
