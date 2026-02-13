package repositories

import (
	"context"
	"database/sql"
	"github.com/salesai/main-api/internal/core/ports"
)

type notificationRepository struct {
	db *sql.DB
}

func NewNotificationRepository(db *sql.DB) ports.NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) ListByUser(ctx context.Context, userID string) ([]map[string]interface{}, error) {
	query := `
		SELECT id, user_id, type, message, is_read, sent_at
		FROM logs_schema.notifications
		WHERE user_id = $1
		ORDER BY sent_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var id, userID, nType, message, sentAt string
		var isRead bool
		if err := rows.Scan(&id, &userID, &nType, &message, &isRead, &sentAt); err != nil {
			return nil, err
		}
		notifications = append(notifications, map[string]interface{}{
			"id":      id,
			"user_id": userID,
			"type":    nType,
			"message": message,
			"is_read": isRead,
			"sent_at": sentAt,
		})
	}
	return notifications, nil
}

func (r *notificationRepository) MarkAsRead(ctx context.Context, id string) error {
	query := `UPDATE logs_schema.notifications SET is_read = true WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
