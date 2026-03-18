package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserRepository interface {
	EnsureManagerUser(ctx context.Context, managerID, managerName string) (string, error)
}

type userRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) EnsureManagerUser(ctx context.Context, managerID, managerName string) (string, error) {
	// 1. Check if user exists
	var userID string
	err := r.db.QueryRowContext(ctx, "SELECT id FROM auth_schema.users WHERE manager_id = $1 LIMIT 1", managerID).Scan(&userID)
	if err == nil {
		return userID, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}

	// 2. User not found, create one.
	// We need a company_id. In "one business" logic, we just take the first one.
	var companyID string
	err = r.db.QueryRowContext(ctx, "SELECT id FROM auth_schema.companies LIMIT 1").Scan(&companyID)
	if err != nil {
		return "", fmt.Errorf("failed to get company for user creation: %w", err)
	}

	userID = uuid.New().String()
	emailLocal := strings.ToLower(strings.ReplaceAll(managerName, " ", "_"))
	if emailLocal == "" {
		emailLocal = "manager_" + managerID
	}
	email := fmt.Sprintf("%s@gmail.com", emailLocal)

	// Password = managerName as plain text, stored as bcrypt
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(managerName), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO auth_schema.users (id, company_id, email, password_hash, role, manager_id, manager_name, is_active)
		VALUES ($1, $2, $3, $4, 'sales_rep', $5, $6, TRUE)
		ON CONFLICT (email) DO NOTHING
	`, userID, companyID, email, string(passwordHash), managerID, managerName)

	if err != nil {
		return "", err
	}

	// If it was a conflict on email, we might still not have the userID we just generated.
	// Re-fetch just in case.
	err = r.db.QueryRowContext(ctx, "SELECT id FROM auth_schema.users WHERE manager_id = $1 LIMIT 1", managerID).Scan(&userID)
	return userID, err
}
