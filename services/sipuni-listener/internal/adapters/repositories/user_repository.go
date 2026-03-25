package repositories

import (
	"context"
	"database/sql"
	"errors"
	"github.com/salesai/sipuni-listener/internal/core/domain"
	"github.com/salesai/sipuni-listener/internal/core/ports"
)

type userRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) ports.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) FindByManagerID(ctx context.Context, managerID string) (*domain.User, error) {
	query := `
		SELECT id, email, password_hash, role, manager_id, manager_name, first_name, last_name, is_active, last_login, created_at, updated_at, username, phone
		FROM auth_schema.users
		WHERE manager_id = $1
		LIMIT 1
	`
	user := &domain.User{}
	err := r.db.QueryRowContext(ctx, query, managerID).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&user.ManagerName,
		&user.FirstName,
		&user.LastName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.Username,
		&user.Phone,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return user, nil
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO auth_schema.users
		(id, email, password_hash, role, manager_id, manager_name, first_name, last_name, is_active, username, phone, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.ManagerID,
		user.ManagerName,
		user.FirstName,
		user.LastName,
		user.IsActive,
		user.Username,
		user.Phone,
	)
	return err
}
