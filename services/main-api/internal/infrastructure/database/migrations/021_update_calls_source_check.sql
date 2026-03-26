-- Migration 021: Update calls_source_check constraint
-- Description: Add 'sipuni' and 'amocrm' to the list of allowed call sources

ALTER TABLE calls_schema.calls
DROP CONSTRAINT IF EXISTS calls_source_check;

ALTER TABLE calls_schema.calls
ADD CONSTRAINT calls_source_check
CHECK (source IN ('webhook', 'google_sheets', 'manual', 'sipuni', 'amocrm'));
