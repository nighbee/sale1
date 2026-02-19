package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type userRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) ports.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO auth_schema.users
		(id, company_id, email, password_hash, role, manager_id, manager_name, is_active, team_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		user.ID,
		user.CompanyID,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.ManagerID,
		user.ManagerName,
		user.IsActive,
		user.TeamID,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	return err
}

func (r *userRepository) GetByID(ctx context.Context, companyID, id string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id
		FROM auth_schema.users
		WHERE id = $1 AND company_id = $2
	`

	user := &domain.User{}
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(
		&user.ID,
		&user.CompanyID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&user.ManagerName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.TeamID,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}

	return user, err
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id
		FROM auth_schema.users
		WHERE LOWER(email) = LOWER($1)
	`

	user := &domain.User{}
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.CompanyID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&user.ManagerName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.TeamID,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}

	return user, err
}

func (r *userRepository) Update(ctx context.Context, user *domain.User) error {
	query := `
		UPDATE auth_schema.users
		SET email = $2, role = $3, manager_id = $4, manager_name = $5, is_active = $6, updated_at = NOW()
		WHERE id = $1 AND company_id = $7
	`

	_, err := r.db.ExecContext(ctx, query, user.ID, user.Email, user.Role, user.ManagerID, user.ManagerName, user.IsActive, user.CompanyID)
	return err
}

func (r *userRepository) Delete(ctx context.Context, companyID, id string) error {
	query := `DELETE FROM auth_schema.users WHERE id = $1 AND company_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, companyID)
	return err
}

func (r *userRepository) ListByCompany(ctx context.Context, companyID string) ([]*domain.User, error) {
	query := `
		SELECT id, company_id, email, role, manager_id, manager_name,
		       is_active, created_at, updated_at, team_id
		FROM auth_schema.users
		WHERE company_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []*domain.User{}
	for rows.Next() {
		user := &domain.User{}
		err := rows.Scan(
			&user.ID,
			&user.CompanyID,
			&user.Email,
			&user.Role,
			&user.ManagerID,
			&user.ManagerName,
			&user.IsActive,
			&user.CreatedAt,
			&user.UpdatedAt,
			&user.TeamID,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}
