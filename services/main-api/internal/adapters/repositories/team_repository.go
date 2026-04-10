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

func (r *teamRepository) GetByID(ctx context.Context, id string, companyID string) (*domain.Team, error) {
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

func (r *teamRepository) GetByName(ctx context.Context, name string, companyID string) (*domain.Team, error) {
	query := `
		SELECT id, company_id, name, description, auto_assign, created_at, updated_at
		FROM auth_schema.teams
		WHERE name = $1 AND company_id = $2
		LIMIT 1
	`
	team := &domain.Team{}
	err := r.db.QueryRowContext(ctx, query, name, companyID).Scan(
		&team.ID, &team.CompanyID, &team.Name, &team.Description, &team.AutoAssign, &team.CreatedAt, &team.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return team, err
}

func (r *teamRepository) List(ctx context.Context, companyID string) ([]*domain.Team, error) {
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

func (r *teamRepository) ListAll(ctx context.Context) ([]*domain.Team, error) {
	query := `
		SELECT id, company_id, name, description, auto_assign, created_at, updated_at
		FROM auth_schema.teams
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
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
		SET name = $2, description = $3, auto_assign = $4, updated_at = NOW()
		WHERE id = $1 AND company_id = $5
	`
	_, err := r.db.ExecContext(ctx, query, team.ID, team.Name, team.Description, team.AutoAssign, team.CompanyID)
	return err
}

func (r *teamRepository) Delete(ctx context.Context, id string, companyID string) error {
	query := `DELETE FROM auth_schema.teams WHERE id = $1 AND company_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, companyID)
	return err
}
