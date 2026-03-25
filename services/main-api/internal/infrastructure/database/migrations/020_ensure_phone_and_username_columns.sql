-- Migration 020: Ensure phone and username columns exist
-- Purpose: Idempotent safety migration to add `phone` and `username` columns
-- and backfill username from email if missing. Safe for production.

-- Run inside a transaction so either all changes apply or none do.
BEGIN;

-- Add columns only if they do not exist (Postgres syntax)
ALTER TABLE auth_schema.users
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

ALTER TABLE auth_schema.users
    ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Backfill username values from email where username is NULL
UPDATE auth_schema.users
SET username = email
WHERE username IS NULL;

COMMIT;

-- Notes:
-- 1) This migration is intentionally idempotent (uses IF NOT EXISTS).
-- 2) Backfilling username from email is safe but you may want different
--    behavior for your production data (consult your data retention / user
--    conventions before changing values).
-- 3) Always take a DB backup before running migrations on production.
