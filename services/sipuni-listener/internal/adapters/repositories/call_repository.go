package repositories

import (
	"context"
	"database/sql"
	"github.com/google/uuid"
	"github.com/salesai/sipuni-listener/internal/core/domain"
)

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
	EnsureUserExists(ctx context.Context, companyID, managerID, managerName string) error
}

type callRepository struct {
	db *sql.DB
}

func NewCallRepository(db *sql.DB) CallRepository {
	return &callRepository{db: db}
}

func get_user_uuid(managerID string) string {
	_, err := uuid.Parse(managerID)
	if err == nil {
		return managerID
	}
	// Generate deterministic UUID from string
	return uuid.NewSHA1(uuid.NameSpaceDNS, []byte(managerID)).String()
}

func (r *callRepository) EnsureUserExists(ctx context.Context, companyID, managerID, managerName string) error {
	userID := get_user_uuid(managerID)

	// Check if user exists
	var id string
	err := r.db.QueryRowContext(ctx, "SELECT id FROM auth_schema.users WHERE id = $1", userID).Scan(&id)
	if err == nil {
		return nil // User exists
	}

	email := "manager_" + userID[:8] + "@example.com"
	query := `
		INSERT INTO auth_schema.users
		(id, company_id, email, password_hash, role, manager_name, is_active, first_name, last_name)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, '')
		ON CONFLICT (id) DO NOTHING
	`
	_, err = r.db.ExecContext(ctx, query, userID, companyID, email, "disabled", "sales_rep", managerName, managerName)
	return err
}

func (r *callRepository) Create(ctx context.Context, call *domain.Call) error {
	query := `
		INSERT INTO calls_schema.calls
		(id, company_id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.ExecContext(
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
	)
	return err
}
