-- Migration 034: Add line_id and src_num to users
-- Description: Add line_id and src_num columns to auth_schema.users to support Sipuni integration improvements

ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS line_id VARCHAR(50);
ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS src_num VARCHAR(50);
