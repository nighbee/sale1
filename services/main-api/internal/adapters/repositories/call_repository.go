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
		(id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, storage_link, chat_link, call_date, call_time, status, source, external_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
		call.StorageLink,
		call.ChatLink,
		call.CallDate,
		call.CallTime,
		call.Status,
		call.Source,
		call.ExternalID,
	).Scan(&call.CreatedAt, &call.UpdatedAt)

	return err
}

func (r *callRepository) GetByID(ctx context.Context, id string, companyID string) (*domain.Call, error) {
	query := `
		SELECT c.id, c.company_id, c.manager_id, c.manager_name, c.client_phone, c.client_id, c.duration, c.call_link, c.storage_link, c.chat_link, c.call_date, c.call_time, c.status, c.source, c.external_id, c.created_at, c.updated_at,
		       EXTRACT(EPOCH FROM (ar.processed_at - c.created_at))::INT AS analysis_time
		FROM calls_schema.calls c
		LEFT JOIN calls_schema.analysis_reports ar ON ar.call_id = c.id
		WHERE (c.id::text = $1 OR c.external_id = $1) AND c.company_id = $2
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
		&call.StorageLink,
		&call.ChatLink,
		&call.CallDate,
		&call.CallTime,
		&call.Status,
		&call.Source,
		&call.ExternalID,
		&call.CreatedAt,
		&call.UpdatedAt,
		&call.AnalysisTime,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("call not found")
	}

	return call, err
}

func (r *callRepository) GetByIDInternal(ctx context.Context, id string) (*domain.Call, error) {
	query := `
		SELECT id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, storage_link, chat_link, call_date, call_time, status, source, external_id, created_at, updated_at
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
		&call.StorageLink,
		&call.ChatLink,
		&call.CallDate,
		&call.CallTime,
		&call.Status,
		&call.Source,
		&call.ExternalID,
		&call.CreatedAt,
		&call.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("call not found")
	}

	return call, err
}

func (r *callRepository) ListAll(ctx context.Context, filters map[string]interface{}) ([]*domain.Call, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if companyID, ok := filters["company_id"].(string); ok && companyID != "" {
		where = append(where, fmt.Sprintf("c.company_id = $%d", argIdx))
		args = append(args, companyID)
		argIdx++
	}

	if managerID, ok := filters["manager_id"].(string); ok && managerID != "" {
		where = append(where, fmt.Sprintf("c.manager_id = $%d", argIdx))
		args = append(args, managerID)
		argIdx++
	}

	if status, ok := filters["status"].(string); ok && status != "" {
		where = append(where, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, status)
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
		SELECT c.id, c.company_id, c.manager_id, c.manager_name, c.client_phone, c.client_id,
		       c.duration, c.call_link, c.storage_link, c.chat_link, c.call_date, c.call_time,
		       c.status, c.source, c.external_id, c.created_at, c.updated_at
		FROM calls_schema.calls c
		WHERE %s
		ORDER BY c.created_at DESC
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
			&call.StorageLink,
			&call.ChatLink,
			&call.CallDate,
			&call.CallTime,
			&call.Status,
			&call.Source,
			&call.ExternalID,
			&call.CreatedAt,
			&call.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		calls = append(calls, call)
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM calls_schema.calls c WHERE %s", strings.Join(where, " AND "))
	var total int
	err = r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return calls, total, nil
}

func (r *callRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.Call, int, map[string]int, error) {
	where := []string{"1=1"}
	countsWhere := []string{"1=1"}
	args := []interface{}{}
	countsArgs := []interface{}{}
	argIdx := 1
	countsArgIdx := 1

	if companyID, ok := filters["company_id"].(string); ok && companyID != "" {
		where = append(where, fmt.Sprintf("c.company_id = $%d", argIdx))
		args = append(args, companyID)
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.company_id = $%d", countsArgIdx))
		countsArgs = append(countsArgs, companyID)
		countsArgIdx++
	} else {
		// Enforce multi-tenancy: company_id must be provided
		return nil, 0, nil, errors.New("company_id filter is required")
	}

	if managerID, ok := filters["manager_id"].(string); ok && managerID != "" {
		where = append(where, fmt.Sprintf("c.manager_id = $%d", argIdx))
		args = append(args, managerID)
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.manager_id = $%d", countsArgIdx))
		countsArgs = append(countsArgs, managerID)
		countsArgIdx++
	}

	if teamID, ok := filters["team_id"].(string); ok && teamID != "" {
		where = append(where, fmt.Sprintf("c.manager_id IN (SELECT manager_id FROM auth_schema.users WHERE team_id = $%d AND company_id = c.company_id)", argIdx))
		args = append(args, teamID)
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.manager_id IN (SELECT manager_id FROM auth_schema.users WHERE team_id = $%d AND company_id = c.company_id)", countsArgIdx))
		countsArgs = append(countsArgs, teamID)
		countsArgIdx++
	}

	if source, ok := filters["source"].(string); ok && source != "" {
		where = append(where, fmt.Sprintf("c.source = $%d", argIdx))
		args = append(args, source)
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.source = $%d", countsArgIdx))
		countsArgs = append(countsArgs, source)
		countsArgIdx++
	}

	if managerName, ok := filters["manager_name"].(string); ok && managerName != "" {
		where = append(where, fmt.Sprintf("c.manager_name ILIKE $%d", argIdx))
		args = append(args, "%"+managerName+"%")
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.manager_name ILIKE $%d", countsArgIdx))
		countsArgs = append(countsArgs, "%"+managerName+"%")
		countsArgIdx++
	}

	if clientPhone, ok := filters["client_phone"].(string); ok && clientPhone != "" {
		where = append(where, fmt.Sprintf("c.client_phone ILIKE $%d", argIdx))
		args = append(args, "%"+clientPhone+"%")
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.client_phone ILIKE $%d", countsArgIdx))
		countsArgs = append(countsArgs, "%"+clientPhone+"%")
		countsArgIdx++
	}

	if dateFrom, ok := filters["date_from"].(string); ok && dateFrom != "" {
		where = append(where, fmt.Sprintf("c.call_date >= $%d", argIdx))
		args = append(args, dateFrom)
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.call_date >= $%d", countsArgIdx))
		countsArgs = append(countsArgs, dateFrom)
		countsArgIdx++
	}

	if dateTo, ok := filters["date_to"].(string); ok && dateTo != "" {
		where = append(where, fmt.Sprintf("c.call_date <= $%d", argIdx))
		args = append(args, dateTo)
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("c.call_date <= $%d", countsArgIdx))
		countsArgs = append(countsArgs, dateTo)
		countsArgIdx++
	}

	if status, ok := filters["status"].(string); ok && status != "" {
		where = append(where, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if search, ok := filters["search"].(string); ok && search != "" {
		where = append(where, fmt.Sprintf("(c.manager_name ILIKE $%d OR c.client_phone ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++

		countsWhere = append(countsWhere, fmt.Sprintf("(c.manager_name ILIKE $%d OR c.client_phone ILIKE $%d)", countsArgIdx, countsArgIdx))
		countsArgs = append(countsArgs, "%"+search+"%")
		countsArgIdx++
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
		SELECT c.id, c.company_id, c.manager_id, c.manager_name, c.client_phone, c.client_id,
		       c.duration, c.call_link, c.storage_link, c.chat_link, c.call_date, c.call_time,
		       c.status, c.source, c.external_id, c.created_at, c.updated_at,
		       ar.quality_score, ar.script_match, ar.errors_free,
		       EXTRACT(EPOCH FROM (ar.processed_at - c.created_at))::INT AS analysis_time
		FROM calls_schema.calls c
		LEFT JOIN calls_schema.analysis_reports ar ON ar.call_id = c.id
		WHERE %s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), argIdx, argIdx+1)

	rows, err := r.db.QueryContext(ctx, query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, nil, err
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
			&call.StorageLink,
			&call.ChatLink,
			&call.CallDate,
			&call.CallTime,
			&call.Status,
			&call.Source,
			&call.ExternalID,
			&call.CreatedAt,
			&call.UpdatedAt,
			&call.QualityScore,
			&call.ScriptMatch,
			&call.ErrorsFree,
			&call.AnalysisTime,
		)
		if err != nil {
			return nil, 0, nil, err
		}
		calls = append(calls, call)
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM calls_schema.calls c WHERE %s", strings.Join(where, " AND "))
	var total int
	err = r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, nil, err
	}

	// Status counts (ignoring status filter itself to get counts for all statuses)
	statusCountsQuery := fmt.Sprintf(`
		SELECT status, COUNT(*)
		FROM calls_schema.calls c
		WHERE %s
		GROUP BY status
	`, strings.Join(countsWhere, " AND "))

	statusRows, err := r.db.QueryContext(ctx, statusCountsQuery, countsArgs...)
	if err != nil {
		return nil, 0, nil, err
	}
	defer statusRows.Close()

	statusCounts := make(map[string]int)
	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err != nil {
			return nil, 0, nil, err
		}
		statusCounts[status] = count
	}

	return calls, total, statusCounts, nil
}

func (r *callRepository) UpdateStatus(ctx context.Context, id string, status domain.CallStatus) error {
	query := `UPDATE calls_schema.calls SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, status)
	return err
}

func (r *callRepository) UpdateStatusByFilter(ctx context.Context, companyID string, filters map[string]interface{}, status domain.CallStatus) error {
	where := []string{"company_id = $1"}
	args := []interface{}{companyID, status}
	argIdx := 3

	if dateFrom, ok := filters["date_from"].(string); ok && dateFrom != "" {
		where = append(where, fmt.Sprintf("call_date >= $%d", argIdx))
		args = append(args, dateFrom)
		argIdx++
	}

	if dateTo, ok := filters["date_to"].(string); ok && dateTo != "" {
		where = append(where, fmt.Sprintf("call_date <= $%d", argIdx))
		args = append(args, dateTo)
		argIdx++
	}

	if currentStatus, ok := filters["current_status"].(string); ok && currentStatus != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, currentStatus)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE calls_schema.calls SET status = $2, updated_at = NOW() WHERE %s", strings.Join(where, " AND "))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}
