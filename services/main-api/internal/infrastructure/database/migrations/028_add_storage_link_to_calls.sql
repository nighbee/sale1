-- Migration 028: Add storage_link to calls
-- Description: Store MinIO storage path separately from original source link

ALTER TABLE calls_schema.calls ADD COLUMN IF NOT EXISTS storage_link VARCHAR(500);

-- Migrate existing MinIO links from call_link to storage_link
UPDATE calls_schema.calls SET storage_link = call_link WHERE call_link LIKE 'minio://%';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_calls_storage_link ON calls_schema.calls(storage_link);
