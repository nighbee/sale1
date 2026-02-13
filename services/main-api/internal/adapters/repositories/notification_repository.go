package repositories

import (
	"context"
	"database/sql"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type notificationRepository struct {
	db *sql.DB
}

func NewNotificationRepository(db *sql.DB) ports.NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) ListByUser(ctx context.Context, userID string) ([]*domain.Notification, error) {
	query := `
		SELECT id, user_id, type, subject, message, is_read, sent_at
		FROM logs_schema.notifications
		WHERE user_id = $1
		ORDER BY sent_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []*domain.Notification
	for rows.Next() {
		n := &domain.Notification{}
		err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Subject, &n.Message, &n.IsRead, &n.SentAt)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}

	return notifications, nil
}

func (r *notificationRepository) MarkAsRead(ctx context.Context, userID, id string) error {
	query := `UPDATE logs_schema.notifications SET is_read = true WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	return err
}

func (r *notificationRepository) Create(ctx context.Context, n *domain.Notification) error {
	query := `
		INSERT INTO logs_schema.notifications (id, user_id, type, subject, message, is_read, sent_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING sent_at
	`
	return r.db.QueryRowContext(ctx, query, n.ID, n.UserID, n.Type, n.Subject, n.Message, n.IsRead).Scan(&n.SentAt)
}
