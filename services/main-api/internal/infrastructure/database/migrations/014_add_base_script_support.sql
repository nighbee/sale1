ALTER TABLE scripts_schema.scripts ADD COLUMN IF NOT EXISTS is_base_script BOOLEAN DEFAULT FALSE;
ALTER TABLE scripts_schema.scripts ADD COLUMN IF NOT EXISTS is_active_base BOOLEAN DEFAULT FALSE;
ALTER TABLE scripts_schema.scripts ADD COLUMN IF NOT EXISTS base_script_metrics JSONB;

ALTER TABLE scripts_schema.scripts ALTER COLUMN company_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scripts_base_script ON scripts_schema.scripts(is_base_script) WHERE is_base_script = TRUE;
CREATE INDEX IF NOT EXISTS idx_scripts_active_base ON scripts_schema.scripts(is_active_base) WHERE is_active_base = TRUE;
