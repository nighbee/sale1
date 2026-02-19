package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type teamRepository struct {
	db *sql.DB
}

func NewTeamRepository(db *sql.DB) ports.TeamRepository {
	return &teamRepository{db: db}
}

func (r *teamRepository) Create(ctx context.Context, team *domain.Team) error {
	query := `
		INSERT INTO auth_schema.teams
		(id, company_id, name, description, auto_assign)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		team.ID, team.CompanyID, team.Name, team.Description, team.AutoAssign,
	).Scan(&team.CreatedAt, &team.UpdatedAt)
}

func (r *teamRepository) GetByID(ctx context.Context, companyID, id string) (*domain.Team, error) {
	query := `
		SELECT id, company_id, name, description, auto_assign, created_at, updated_at
		FROM auth_schema.teams
		WHERE id = $1 AND company_id = $2
	`
	team := &domain.Team{}
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(
		&team.ID, &team.CompanyID, &team.Name, &team.Description, &team.AutoAssign, &team.CreatedAt, &team.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("team not found")
	}
	return team, err
}

func (r *teamRepository) ListByCompany(ctx context.Context, companyID string) ([]*domain.Team, error) {
	query := `
		SELECT id, company_id, name, description, auto_assign, created_at, updated_at
		FROM auth_schema.teams
		WHERE company_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	teams := []*domain.Team{}
	for rows.Next() {
		team := &domain.Team{}
		if err := rows.Scan(&team.ID, &team.CompanyID, &team.Name, &team.Description, &team.AutoAssign, &team.CreatedAt, &team.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}
	return teams, nil
}

func (r *teamRepository) Update(ctx context.Context, team *domain.Team) error {
	query := `
		UPDATE auth_schema.teams
		SET name = $3, description = $4, auto_assign = $5, updated_at = NOW()
		WHERE id = $1 AND company_id = $2
	`
	_, err := r.db.ExecContext(ctx, query, team.ID, team.CompanyID, team.Name, team.Description, team.AutoAssign)
	return err
}

func (r *teamRepository) Delete(ctx context.Context, companyID, id string) error {
	query := `DELETE FROM auth_schema.teams WHERE id = $1 AND company_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, companyID)
	return err
}

func (r *teamRepository) AddMember(ctx context.Context, teamID, userID string) error {
	query := `INSERT INTO auth_schema.user_teams (user_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, userID, teamID)
	return err
}

func (r *teamRepository) RemoveMember(ctx context.Context, teamID, userID string) error {
	query := `DELETE FROM auth_schema.user_teams WHERE user_id = $1 AND team_id = $2`
	_, err := r.db.ExecContext(ctx, query, userID, teamID)
	return err
}

func (r *teamRepository) GetMembers(ctx context.Context, teamID string) ([]*domain.User, error) {
	query := `
		SELECT u.id, u.company_id, u.first_name, u.last_name, u.email, u.role, u.manager_id, u.manager_name, u.is_active, u.created_at, u.updated_at
		FROM auth_schema.users u
		JOIN auth_schema.user_teams ut ON u.id = ut.user_id
		WHERE ut.team_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []*domain.User{}
	for rows.Next() {
		u := &domain.User{}
		if err := rows.Scan(
			&u.ID, &u.CompanyID, &u.FirstName, &u.LastName, &u.Email, &u.Role, &u.ManagerID, &u.ManagerName, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}
