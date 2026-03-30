-- Migration 024: Set Gemini as default LLM provider and model
UPDATE calls_schema.ai_settings
SET llm_provider = 'gemini',
    llm_model = 'gemini-3-flash-preview',
    updated_at = CURRENT_TIMESTAMP
WHERE id = (SELECT id FROM calls_schema.ai_settings LIMIT 1);

-- Ensure future records also default to gemini if desired (though app logic usually handles this)
ALTER TABLE calls_schema.ai_settings ALTER COLUMN llm_provider SET DEFAULT 'gemini';
ALTER TABLE calls_schema.ai_settings ALTER COLUMN llm_model SET DEFAULT 'gemini-3-flash-preview';
