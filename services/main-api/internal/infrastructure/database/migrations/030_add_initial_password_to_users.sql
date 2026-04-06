-- Migration 030: Add initial_password to users
-- Description: Add initial_password column to auth_schema.users to store auto-generated passwords for managers

ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS initial_password VARCHAR(255);
