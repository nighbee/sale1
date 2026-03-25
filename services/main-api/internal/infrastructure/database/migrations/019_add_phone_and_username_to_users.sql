-- Migration 019: Add phone and username to users
-- Description: Add phone and username columns to auth_schema.users

ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE auth_schema.users ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Update username to email if it was previously empty (optional, but good for data consistency)
UPDATE auth_schema.users SET username = email WHERE username IS NULL;
