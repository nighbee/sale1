-- =============================================
-- Migration 036: Sync Manager Name to Calls
-- Description: Keep manager_name in calls table in sync with users table
-- Author: SalesAI Team
-- Date: 2026-02-15
-- =============================================

-- Note: In this system, auth_schema.users.manager_id represents the user's extension.
-- auth_schema.users.manager_name is the display name for that user in call records.

-- 1. Sync existing data
UPDATE calls_schema.calls c
SET manager_name = u.manager_name
FROM auth_schema.users u
WHERE c.manager_id = u.manager_id
  AND c.company_id = u.company_id
  AND u.manager_id IS NOT NULL
  AND (c.manager_name IS DISTINCT FROM u.manager_name);

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION auth_schema.sync_manager_name_to_calls()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE calls_schema.calls
    SET manager_name = NEW.manager_name
    WHERE manager_id = NEW.manager_id
      AND company_id = NEW.company_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
DROP TRIGGER IF EXISTS sync_manager_name_trigger ON auth_schema.users;
CREATE TRIGGER sync_manager_name_trigger
AFTER UPDATE ON auth_schema.users
FOR EACH ROW
WHEN (OLD.manager_name IS DISTINCT FROM NEW.manager_name OR (OLD.manager_id IS DISTINCT FROM NEW.manager_id AND NEW.manager_id IS NOT NULL))
EXECUTE FUNCTION auth_schema.sync_manager_name_to_calls();
