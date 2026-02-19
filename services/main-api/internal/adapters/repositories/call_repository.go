package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type callRepository struct {
	db *sql.DB
}

func NewCallRepository(db *sql.DB) ports.CallRepository {
	return &callRepository{db: db}
}

func (r *callRepository) Create(ctx context.Context, call *domain.Call) error {
	query := `
		INSERT INTO calls_schema.calls
		(id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source, team_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		call.ID,
		call.CompanyID,
		call.ManagerID,
		call.ManagerName,
		call.ClientPhone,
		call.ClientID,
		call.Duration,
		call.CallLink,
		call.ChatLink,
		call.CallDate,
		call.CallTime,
		call.Status,
		call.Source,
		call.TeamID,
	).Scan(&call.CreatedAt, &call.UpdatedAt)

	return err
}

func (r *callRepository) GetByID(ctx context.Context, companyID, id string) (*domain.Call, error) {
	query := `
		SELECT id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source, created_at, updated_at, team_id
		FROM calls_schema.calls
		WHERE id = $1 AND company_id = $2
	`

	call := &domain.Call{}
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(
		&call.ID,
		&call.CompanyID,
		&call.ManagerID,
		&call.ManagerName,
		&call.ClientPhone,
		&call.ClientID,
		&call.Duration,
		&call.CallLink,
		&call.ChatLink,
		&call.CallDate,
		&call.CallTime,
		&call.Status,
		&call.Source,
		&call.CreatedAt,
		&call.UpdatedAt,
		&call.TeamID,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("call not found")
	}

	return call, err
}

func (r *callRepository) GetByIDInternal(ctx context.Context, id string) (*domain.Call, error) {
	query := `
		SELECT id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source, created_at, updated_at, team_id
		FROM calls_schema.calls
		WHERE id = $1
	`

	call := &domain.Call{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&call.ID,
		&call.CompanyID,
		&call.ManagerID,
		&call.ManagerName,
		&call.ClientPhone,
		&call.ClientID,
		&call.Duration,
		&call.CallLink,
		&call.ChatLink,
		&call.CallDate,
		&call.CallTime,
		&call.Status,
		&call.Source,
		&call.CreatedAt,
		&call.UpdatedAt,
		&call.TeamID,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("call not found")
	}

	return call, err
}

func (r *callRepository) ListByCompany(ctx context.Context, companyID string, filters map[string]interface{}) ([]*domain.Call, int, error) {
	where := []string{"company_id = $1"}
	args := []interface{}{companyID}
	argIdx := 2

	if managerID, ok := filters["manager_id"].(string); ok && managerID != "" {
		where = append(where, fmt.Sprintf("manager_id = $%d", argIdx))
		args = append(args, managerID)
		argIdx++
	}

	if teamID, ok := filters["team_id"].(string); ok && teamID != "" {
		where = append(where, fmt.Sprintf("team_id = $%d", argIdx))
		args = append(args, teamID)
		argIdx++
	}

	if status, ok := filters["status"].(string); ok && status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	// Pagination
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
		SELECT id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source, created_at, updated_at, team_id
		FROM calls_schema.calls
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), argIdx, argIdx+1)

	rows, err := r.db.QueryContext(ctx, query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	calls := []*domain.Call{}
	for rows.Next() {
		call := &domain.Call{}
		err := rows.Scan(
			&call.ID,
			&call.CompanyID,
			&call.ManagerID,
			&call.ManagerName,
			&call.ClientPhone,
			&call.ClientID,
			&call.Duration,
			&call.CallLink,
			&call.ChatLink,
			&call.CallDate,
			&call.CallTime,
			&call.Status,
			&call.Source,
			&call.CreatedAt,
			&call.UpdatedAt,
			&call.TeamID,
		)
		if err != nil {
			return nil, 0, err
		}
		calls = append(calls, call)
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM calls_schema.calls WHERE %s", strings.Join(where, " AND "))
	var total int
	err = r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return calls, total, nil
}

func (r *callRepository) UpdateStatus(ctx context.Context, id string, status domain.CallStatus) error {
	query := `UPDATE calls_schema.calls SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, status)
	return err
}
