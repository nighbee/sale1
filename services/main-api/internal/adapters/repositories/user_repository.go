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
		(id, company_id, email, password_hash, role, manager_id, manager_name, is_active, team_id, first_name, last_name, username, phone, initial_password)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
		user.Username,
		user.Phone,
		user.InitialPassword,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	return err
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name, username, phone, initial_password
		FROM auth_schema.users
		WHERE id = $1
	`

	user := &domain.User{}
	// scan nullable columns into sql.NullString to avoid converting NULL -> string errors
	var mName, fName, lName, username, phone, initPass sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.CompanyID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&mName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.TeamID,
		&fName,
		&lName,
		&username,
		&phone,
		&initPass,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	user.ManagerName = mName.String
	user.FirstName = fName.String
	user.LastName = lName.String
	user.Username = username.String
	user.Phone = phone.String
	if initPass.Valid {
		user.InitialPassword = &initPass.String
	}

	return user, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name, username, phone, initial_password
		FROM auth_schema.users
		WHERE LOWER(email) = LOWER($1)
	`

	user := &domain.User{}
	var mName, fName, lName, username, phone, initPass sql.NullString

	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.CompanyID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&mName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.TeamID,
		&fName,
		&lName,
		&username,
		&phone,
		&initPass,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	user.ManagerName = mName.String
	user.FirstName = fName.String
	user.LastName = lName.String
	user.Username = username.String
	user.Phone = phone.String
	if initPass.Valid {
		user.InitialPassword = &initPass.String
	}

	return user, nil
}

func (r *userRepository) Update(ctx context.Context, user *domain.User) error {
	query := `
		UPDATE auth_schema.users
		SET email = $2, role = $3, manager_id = $4, manager_name = $5, is_active = $6, updated_at = NOW(),
		    first_name = $7, last_name = $8, password_hash = $9, username = $10, phone = $11, team_id = $12, initial_password = $13
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, user.ID, user.Email, user.Role, user.ManagerID, user.ManagerName, user.IsActive, user.FirstName, user.LastName, user.PasswordHash, user.Username, user.Phone, user.TeamID, user.InitialPassword)
	return err
}

func (r *userRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM auth_schema.users WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *userRepository) List(ctx context.Context, companyID string) ([]*domain.User, error) {
	query := `
		SELECT id, company_id, email, role, manager_id, manager_name,
		       is_active, created_at, updated_at, team_id, first_name, last_name, username, phone, initial_password
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
		var mName, fName, lName, username, phone, initPass sql.NullString
		err := rows.Scan(
			&user.ID,
			&user.CompanyID,
			&user.Email,
			&user.Role,
			&user.ManagerID,
			&mName,
			&user.IsActive,
			&user.CreatedAt,
			&user.UpdatedAt,
			&user.TeamID,
			&fName,
			&lName,
			&username,
			&phone,
			&initPass,
		)
		if err != nil {
			return nil, err
		}
		user.ManagerName = mName.String
		user.FirstName = fName.String
		user.LastName = lName.String
		user.Username = username.String
		user.Phone = phone.String
		if initPass.Valid {
			user.InitialPassword = &initPass.String
		}
		users = append(users, user)
	}

	return users, nil
}

func (r *userRepository) ListAll(ctx context.Context) ([]*domain.User, error) {
	query := `
		SELECT id, company_id, email, role, manager_id, manager_name,
		       is_active, created_at, updated_at, team_id, first_name, last_name, username, phone, initial_password
		FROM auth_schema.users
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []*domain.User{}
	for rows.Next() {
		user := &domain.User{}
		var mName, fName, lName, username, phone, initPass sql.NullString
		err := rows.Scan(
			&user.ID,
			&user.CompanyID,
			&user.Email,
			&user.Role,
			&user.ManagerID,
			&mName,
			&user.IsActive,
			&user.CreatedAt,
			&user.UpdatedAt,
			&user.TeamID,
			&fName,
			&lName,
			&username,
			&phone,
			&initPass,
		)
		if err != nil {
			return nil, err
		}
		user.ManagerName = mName.String
		user.FirstName = fName.String
		user.LastName = lName.String
		user.Username = username.String
		user.Phone = phone.String
		if initPass.Valid {
			user.InitialPassword = &initPass.String
		}
		users = append(users, user)
	}

	return users, nil
}

func (r *userRepository) GetByManagerID(ctx context.Context, managerID string, companyID string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
		       is_active, last_login, created_at, updated_at, team_id, first_name, last_name, username, phone, initial_password
		FROM auth_schema.users
		WHERE manager_id = $1 AND company_id = $2
		LIMIT 1
	`

	user := &domain.User{}
	var mName, fName, lName, username, phone, initPass sql.NullString
	err := r.db.QueryRowContext(ctx, query, managerID, companyID).Scan(
		&user.ID,
		&user.CompanyID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&mName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.TeamID,
		&fName,
		&lName,
		&username,
		&phone,
		&initPass,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	user.ManagerName = mName.String
	user.FirstName = fName.String
	user.LastName = lName.String
	user.Username = username.String
	user.Phone = phone.String
	if initPass.Valid {
		user.InitialPassword = &initPass.String
	}

	return user, nil
}

// GetByPhone finds a user by phone number
func (r *userRepository) GetByPhone(ctx context.Context, phone string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
			   is_active, last_login, created_at, updated_at, team_id, first_name, last_name, username, phone, initial_password
		FROM auth_schema.users
		WHERE phone = $1
		LIMIT 1
	`

	user := &domain.User{}
	var mName, fName, lName, username, phoneNS, initPass sql.NullString
	err := r.db.QueryRowContext(ctx, query, phone).Scan(
		&user.ID,
		&user.CompanyID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.ManagerID,
		&mName,
		&user.IsActive,
		&user.LastLogin,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.TeamID,
		&fName,
		&lName,
		&username,
		&phoneNS,
		&initPass,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	user.ManagerName = mName.String
	user.FirstName = fName.String
	user.LastName = lName.String
	user.Username = username.String
	user.Phone = phoneNS.String
	if initPass.Valid {
		user.InitialPassword = &initPass.String
	}

	return user, nil
}
