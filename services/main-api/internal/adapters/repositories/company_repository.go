package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type companyRepository struct {
	db *sql.DB
}

func NewCompanyRepository(db *sql.DB) ports.CompanyRepository {
	return &companyRepository{db: db}
}

func (r *companyRepository) Create(ctx context.Context, company *domain.Company) error {
	query := `
		INSERT INTO auth_schema.companies
		(id, name, stt_model_preference, llm_provider, subscription_tier, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		company.ID,
		company.Name,
		company.STTModelPreference,
		company.LLMProvider,
		company.SubscriptionTier,
		company.IsActive,
	).Scan(&company.CreatedAt, &company.UpdatedAt)

	return err
}

func (r *companyRepository) GetByID(ctx context.Context, id string) (*domain.Company, error) {
	query := `
		SELECT id, name, stt_model_preference, llm_provider, subscription_tier, is_active, created_at, updated_at
		FROM auth_schema.companies
		WHERE id = $1
	`

	company := &domain.Company{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&company.ID,
		&company.Name,
		&company.STTModelPreference,
		&company.LLMProvider,
		&company.SubscriptionTier,
		&company.IsActive,
		&company.CreatedAt,
		&company.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("company not found")
	}

	return company, err
}

func (r *companyRepository) Update(ctx context.Context, company *domain.Company) error {
	query := `
		UPDATE auth_schema.companies
		SET name = $2, stt_model_preference = $3, llm_provider = $4, subscription_tier = $5, is_active = $6, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, company.ID, company.Name, company.STTModelPreference, company.LLMProvider, company.SubscriptionTier, company.IsActive)
	return err
}
