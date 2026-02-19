-- Migration 011: User Teams and Call Team
-- Description: Add many-to-many relationship for users and teams, and link calls to teams.

-- Create user_teams junction table
CREATE TABLE IF NOT EXISTS auth_schema.user_teams (
    user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES auth_schema.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, team_id)
);

-- Migrate existing team_id from users to user_teams
INSERT INTO auth_schema.user_teams (user_id, team_id)
SELECT id, team_id FROM auth_schema.users
WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add team_id to calls
ALTER TABLE calls_schema.calls ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES auth_schema.teams(id) ON DELETE SET NULL;

-- Populate team_id in calls based on manager's current team (best effort)
UPDATE calls_schema.calls c
SET team_id = u.team_id
FROM auth_schema.users u
WHERE c.manager_id = u.id AND c.team_id IS NULL;

-- Update Views to include team_id
CREATE OR REPLACE VIEW calls_schema.v_calls_with_analysis AS
SELECT
    c.id,
    c.company_id,
    c.team_id,
    c.manager_id,
    c.manager_name,
    c.client_phone,
    c.duration,
    c.call_date,
    c.call_time,
    c.status,
    ar.quality_score,
    ar.script_match,
    ar.errors_free,
    ar.overall_rating,
    ar.kpi,
    ar.brief,
    ar.recommendation,
    ar.next_best_action
FROM calls_schema.calls c
LEFT JOIN calls_schema.analysis_reports ar ON c.id = ar.call_id;

CREATE OR REPLACE VIEW calls_schema.v_manager_performance AS
SELECT
    company_id,
    team_id,
    manager_id,
    manager_name,
    COUNT(id) as total_calls,
    AVG(quality_score) as avg_quality,
    AVG(script_match) as avg_script_match,
    AVG(errors_free) as avg_errors_free,
    AVG(overall_rating) as avg_overall_rating,
    AVG(kpi) as avg_kpi,
    SUM(duration) as total_duration_seconds
FROM calls_schema.v_calls_with_analysis
GROUP BY company_id, team_id, manager_id, manager_name;
