-- =============================================
-- Migration 004: Seed Data for Development
-- Description: Insert test data for local development
-- Author: SalesAI Team
-- Date: 2026-02-08
-- =============================================

INSERT INTO auth_schema.companies (id, name, stt_model_preference, llm_provider, subscription_tier)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Test Company', 'whisperx_local', 'openai', 'pro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_schema.users (id, company_id, email, password_hash, role, manager_id, manager_name)
VALUES
    ('660e8400-e29b-41d4-a716-446655440001',
     '550e8400-e29b-41d4-a716-446655440000',
     'admin@test.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMy.ez09jLGO5RzR5CZY5/VRX5f.6zzGKLe', -- Test1234
     'tenant_admin',
     '001',
     'Test Admin')
ON CONFLICT (id) DO NOTHING;
