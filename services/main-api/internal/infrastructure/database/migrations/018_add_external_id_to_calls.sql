-- Migration 018: Add external_id to calls
-- Description: Store the original call identifier from external sources like Sipuni or AmoCRM

ALTER TABLE calls_schema.calls ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_calls_external_id ON calls_schema.calls(external_id);
