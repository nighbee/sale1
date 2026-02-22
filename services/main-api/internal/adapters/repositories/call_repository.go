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
		(id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		call.ID,
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
	).Scan(&call.CreatedAt, &call.UpdatedAt)

	return err
}

func (r *callRepository) GetByID(ctx context.Context, id string) (*domain.Call, error) {
	query := `
		SELECT id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source, created_at, updated_at
		FROM calls_schema.calls
		WHERE id = $1
	`

	call := &domain.Call{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&call.ID,
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
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("call not found")
	}

	return call, err
}

func (r *callRepository) GetByIDInternal(ctx context.Context, id string) (*domain.Call, error) {
	query := `
		SELECT id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source, created_at, updated_at
		FROM calls_schema.calls
		WHERE id = $1
	`

	call := &domain.Call{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&call.ID,
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
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("call not found")
	}

	return call, err
}

func (r *callRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.Call, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	joins := ""

	if companyID, ok := filters["company_id"].(string); ok && companyID != "" {
		joins = "LEFT JOIN auth_schema.users u ON c.manager_id = u.manager_id"
		where = append(where, fmt.Sprintf("u.company_id = $%d", argIdx))
		args = append(args, companyID)
		argIdx++
	}

	if managerID, ok := filters["manager_id"].(string); ok && managerID != "" {
		where = append(where, fmt.Sprintf("c.manager_id = $%d", argIdx))
		args = append(args, managerID)
		argIdx++
	}

	if teamID, ok := filters["team_id"].(string); ok && teamID != "" {
		where = append(where, fmt.Sprintf("c.manager_id IN (SELECT manager_id FROM auth_schema.users WHERE team_id = $%d)", argIdx))
		args = append(args, teamID)
		argIdx++
	}

	if status, ok := filters["status"].(string); ok && status != "" {
		where = append(where, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if source, ok := filters["source"].(string); ok && source != "" {
		where = append(where, fmt.Sprintf("c.source = $%d", argIdx))
		args = append(args, source)
		argIdx++
	}

	if managerName, ok := filters["manager_name"].(string); ok && managerName != "" {
		where = append(where, fmt.Sprintf("c.manager_name ILIKE $%d", argIdx))
		args = append(args, "%"+managerName+"%")
		argIdx++
	}

	if clientPhone, ok := filters["client_phone"].(string); ok && clientPhone != "" {
		where = append(where, fmt.Sprintf("c.client_phone ILIKE $%d", argIdx))
		args = append(args, "%"+clientPhone+"%")
		argIdx++
	}

	if dateFrom, ok := filters["date_from"].(string); ok && dateFrom != "" {
		where = append(where, fmt.Sprintf("c.call_date >= $%d", argIdx))
		args = append(args, dateFrom)
		argIdx++
	}

	if dateTo, ok := filters["date_to"].(string); ok && dateTo != "" {
		where = append(where, fmt.Sprintf("c.call_date <= $%d", argIdx))
		args = append(args, dateTo)
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
		SELECT c.id, c.manager_id, c.manager_name, c.client_phone, c.client_id,
		       c.duration, c.call_link, c.chat_link, c.call_date, c.call_time,
		       c.status, c.source, c.created_at, c.updated_at,
		       ar.quality_score, ar.script_match, ar.errors_free
		FROM calls_schema.calls c
		%s
		LEFT JOIN calls_schema.analysis_reports ar ON ar.call_id = c.id
		WHERE %s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, joins, strings.Join(where, " AND "), argIdx, argIdx+1)

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
			&call.QualityScore,
			&call.ScriptMatch,
			&call.ErrorsFree,
		)
		if err != nil {
			return nil, 0, err
		}
		calls = append(calls, call)
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM calls_schema.calls c %s WHERE %s", joins, strings.Join(where, " AND "))
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
