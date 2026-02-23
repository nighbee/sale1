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
		(id, company_id, email, password_hash, role, manager_id, manager_name, is_active, team_id, first_name, last_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
		user.FirstName,
		user.LastName,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	return err
}

func (r *userRepository) GetByID(ctx context.Context, companyID, id string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name
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
		&user.FirstName,
		&user.LastName,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}

	return user, err
}

func (r *userRepository) GetByIDGlobal(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name
		FROM auth_schema.users
		WHERE id = $1
	`

	user := &domain.User{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
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
		&user.FirstName,
		&user.LastName,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}

	return user, err
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name
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
		&user.FirstName,
		&user.LastName,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}

	return user, err
}

func (r *userRepository) Update(ctx context.Context, user *domain.User) error {
	query := `
		UPDATE auth_schema.users
		SET email = $2, role = $3, manager_id = $4, manager_name = $5, is_active = $6, updated_at = NOW(),
		    first_name = $8, last_name = $9, password_hash = $10
		WHERE id = $1 AND company_id = $7
	`

	_, err := r.db.ExecContext(ctx, query, user.ID, user.Email, user.Role, user.ManagerID, user.ManagerName, user.IsActive, user.CompanyID, user.FirstName, user.LastName, user.PasswordHash)
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
		       is_active, created_at, updated_at, team_id, first_name, last_name
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
			&user.FirstName,
			&user.LastName,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

func (r *userRepository) AddUserToCompany(ctx context.Context, userID, companyID string, role domain.UserRole) error {
	query := `
		INSERT INTO auth_schema.user_companies (user_id, company_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role
	`
	_, err := r.db.ExecContext(ctx, query, userID, companyID, role)
	return err
}

func (r *userRepository) GetUserCompanies(ctx context.Context, userID string) ([]domain.UserCompany, error) {
	query := `
		SELECT user_id, company_id, role
		FROM auth_schema.user_companies
		WHERE user_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var companies []domain.UserCompany
	for rows.Next() {
		var uc domain.UserCompany
		if err := rows.Scan(&uc.UserID, &uc.CompanyID, &uc.Role); err != nil {
			return nil, err
		}
		companies = append(companies, uc)
	}
	return companies, nil
}

func (r *userRepository) GetByManagerID(ctx context.Context, managerID string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name
		FROM auth_schema.users
		WHERE manager_id = $1
		LIMIT 1
	`

	user := &domain.User{}
	err := r.db.QueryRowContext(ctx, query, managerID).Scan(
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
		&user.FirstName,
		&user.LastName,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}

	return user, err
}
