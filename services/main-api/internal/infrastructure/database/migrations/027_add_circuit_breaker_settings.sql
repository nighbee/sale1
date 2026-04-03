ALTER TABLE calls_schema.ai_settings
ADD COLUMN IF NOT EXISTS stt_language TEXT,
ADD COLUMN IF NOT EXISTS circuit_breaker_enabled BOOLEAN DEFAULT TRUE;
