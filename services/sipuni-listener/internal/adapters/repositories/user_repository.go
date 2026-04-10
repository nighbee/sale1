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

func (r *userRepository) FindByManagerID(ctx context.Context, managerID string, companyID string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name, first_name, last_name, is_active, last_login, created_at, updated_at, username, phone, initial_password, line_id, src_num
		FROM auth_schema.users
		WHERE manager_id = $1 AND company_id = $2
		LIMIT 1
	`
	user := &domain.User{}
	var initPass, lineID, srcNum sql.NullString
	err := r.db.QueryRowContext(ctx, query, managerID, companyID).Scan(
		&user.ID,
		&user.CompanyID,
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
		&initPass,
		&lineID,
		&srcNum,
	)
	if initPass.Valid {
		user.InitialPassword = &initPass.String
	}
	if lineID.Valid {
		user.LineID = &lineID.String
	}
	if srcNum.Valid {
		user.SrcNum = &srcNum.String
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return user, nil
}

func (r *userRepository) FindBySrcNum(ctx context.Context, srcNum string, companyID string) (*domain.User, error) {
	query := `
		SELECT id, company_id, email, password_hash, role, manager_id, manager_name, first_name, last_name, is_active, last_login, created_at, updated_at, username, phone, initial_password, line_id, src_num
		FROM auth_schema.users
		WHERE src_num = $1 AND company_id = $2
		LIMIT 1
	`
	user := &domain.User{}
	var initPass, lineID, srcNumRes sql.NullString
	err := r.db.QueryRowContext(ctx, query, srcNum, companyID).Scan(
		&user.ID,
		&user.CompanyID,
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
		&initPass,
		&lineID,
		&srcNumRes,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if initPass.Valid {
		user.InitialPassword = &initPass.String
	}
	if lineID.Valid {
		user.LineID = &lineID.String
	}
	if srcNumRes.Valid {
		user.SrcNum = &srcNumRes.String
	}
	return user, nil
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO auth_schema.users
		(id, company_id, email, password_hash, role, manager_id, manager_name, first_name, last_name, is_active, username, phone, initial_password, created_at, updated_at, line_id, src_num)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14, $15)
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		user.ID,
		user.CompanyID,
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
		user.InitialPassword,
		user.LineID,
		user.SrcNum,
	)
	return err
}
