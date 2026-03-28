CREATE TABLE IF NOT EXISTS calls_schema.ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stt_provider TEXT NOT NULL DEFAULT 'openai',
    stt_model TEXT,
    llm_provider TEXT NOT NULL DEFAULT 'openai',
    llm_model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed with default values if empty
INSERT INTO calls_schema.ai_settings (stt_provider, llm_provider)
SELECT 'openai', 'openai'
WHERE NOT EXISTS (SELECT 1 FROM calls_schema.ai_settings);
