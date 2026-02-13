CREATE TABLE auth_schema.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    auto_assign BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add team_id to users
ALTER TABLE auth_schema.users ADD COLUMN team_id UUID REFERENCES auth_schema.teams(id) ON DELETE SET NULL;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON auth_schema.teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
