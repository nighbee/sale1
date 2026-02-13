-- Seed Teams
INSERT INTO auth_schema.teams (id, company_id, name, description, auto_assign)
SELECT
    uuid_generate_v4(),
    id,
    'North America Sales',
    'Handling all enterprise accounts in the US and Canada.',
    TRUE
FROM auth_schema.companies
LIMIT 1;

-- Update some users to belong to the team
UPDATE auth_schema.users
SET team_id = (SELECT id FROM auth_schema.teams LIMIT 1)
WHERE role = 'sales_rep';

-- Seed Analysis Reports for Leaderboard (if not already present via previous seeds)
-- This assumes calls and analysis_reports schemas are ready.
-- The v_manager_performance view relies on calls_schema.v_calls_with_analysis
