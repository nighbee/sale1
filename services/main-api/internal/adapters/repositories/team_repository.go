package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

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

func (r *teamRepository) ListAll(ctx context.Context, filters map[string]interface{}) ([]*domain.Team, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if search, ok := filters["search"].(string); ok && search != "" {
		where = append(where, "name ILIKE $"+strconv.Itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	limit := 20
	if l, ok := filters["limit"].(int); ok && l > 0 {
		limit = l
	}
	page := 1
	if p, ok := filters["page"].(int); ok && p > 0 {
		page = p
	}
	offset := (page - 1) * limit

	query := fmt.Sprintf(`
		SELECT id, company_id, name, description, auto_assign, created_at, updated_at
		FROM auth_schema.teams
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), argIdx, argIdx+1)

	rows, err := r.db.QueryContext(ctx, query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	teams := []*domain.Team{}
	for rows.Next() {
		team := &domain.Team{}
		if err := rows.Scan(&team.ID, &team.CompanyID, &team.Name, &team.Description, &team.AutoAssign, &team.CreatedAt, &team.UpdatedAt); err != nil {
			return nil, 0, err
		}
		teams = append(teams, team)
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM auth_schema.teams WHERE %s", strings.Join(where, " AND "))
	var total int
	err = r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return teams, total, nil
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
