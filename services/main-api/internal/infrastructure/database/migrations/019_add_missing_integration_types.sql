-- Migration 019: Add missing integration types
-- Description: Update the integration_type check constraint to include sipuni, openai, groq, deepgram, and gemini

ALTER TABLE integrations_schema.integrations
    DROP CONSTRAINT IF EXISTS integrations_integration_type_check;

ALTER TABLE integrations_schema.integrations
    ADD CONSTRAINT integrations_integration_type_check
        CHECK (integration_type IN ('amocrm', 'google_sheets', 'telegram', 'slack', 'sipuni', 'openai', 'groq', 'deepgram', 'gemini'));
