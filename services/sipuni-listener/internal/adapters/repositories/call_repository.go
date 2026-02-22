package repositories

import (
	"context"
	"database/sql"
	"github.com/salesai/sipuni-listener/internal/core/domain"
)

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
}

type callRepository struct {
	db *sql.DB
}

func NewCallRepository(db *sql.DB) CallRepository {
	return &callRepository{db: db}
}

func (r *callRepository) Create(ctx context.Context, call *domain.Call) error {
	query := `
		INSERT INTO calls_schema.calls
		(id, manager_id, manager_name, client_phone, client_id, duration, call_link, chat_link, call_date, call_time, status, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.ExecContext(
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
	)
	return err
}
