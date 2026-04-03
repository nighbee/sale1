-- Migration 026: Add 'elevenlabs' and 'soniox' to integrations integration_type check constraint
ALTER TABLE integrations_schema.integrations
    DROP CONSTRAINT IF EXISTS integrations_integration_type_check;

ALTER TABLE integrations_schema.integrations
    ADD CONSTRAINT integrations_integration_type_check
        CHECK (integration_type IN ('amocrm', 'google_sheets', 'telegram', 'slack', 'sipuni', 'openai', 'groq', 'deepgram', 'gemini', 'elevenlabs', 'soniox'));
