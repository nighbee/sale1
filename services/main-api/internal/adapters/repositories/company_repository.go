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
		(id, name, industry, size, time_zone, stt_model_preference, llm_provider, subscription_tier, is_active, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		company.ID,
		company.Name,
		company.Industry,
		company.Size,
		company.TimeZone,
		company.STTModelPreference,
		company.LLMProvider,
		company.SubscriptionTier,
		company.IsActive,
		company.Description,
	).Scan(&company.CreatedAt, &company.UpdatedAt)

	return err
}

func (r *companyRepository) GetByID(ctx context.Context, id string) (*domain.Company, error) {
	query := `
		SELECT id, name, industry, size, time_zone, stt_model_preference, llm_provider, subscription_tier, is_active, created_at, updated_at, description
		FROM auth_schema.companies
		WHERE id = $1
	`

	company := &domain.Company{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&company.ID,
		&company.Name,
		&company.Industry,
		&company.Size,
		&company.TimeZone,
		&company.STTModelPreference,
		&company.LLMProvider,
		&company.SubscriptionTier,
		&company.IsActive,
		&company.CreatedAt,
		&company.UpdatedAt,
		&company.Description,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("company not found")
	}

	return company, err
}

func (r *companyRepository) Update(ctx context.Context, company *domain.Company) error {
	query := `
		UPDATE auth_schema.companies
		SET name = $2, industry = $3, size = $4, time_zone = $5, stt_model_preference = $6, llm_provider = $7, subscription_tier = $8, is_active = $9, updated_at = NOW(), description = $10
		WHERE id = $1
	`

	_, err := r.db.ExecContext(
		ctx,
		query,
		company.ID,
		company.Name,
		company.Industry,
		company.Size,
		company.TimeZone,
		company.STTModelPreference,
		company.LLMProvider,
		company.SubscriptionTier,
		company.IsActive,
		company.Description,
	)
	return err
}

func (r *companyRepository) GetBillingInfo(ctx context.Context, companyID string) (*domain.BillingInfo, error) {
	query := `
		SELECT company_id, card_holder_name, card_number_masked, expiration_date, card_type, tokens_used, tokens_limit, created_at, updated_at
		FROM auth_schema.billing_info
		WHERE company_id = $1
	`
	billing := &domain.BillingInfo{}
	err := r.db.QueryRowContext(ctx, query, companyID).Scan(
		&billing.CompanyID,
		&billing.CardHolderName,
		&billing.CardNumberMasked,
		&billing.ExpirationDate,
		&billing.CardType,
		&billing.TokensUsed,
		&billing.TokensLimit,
		&billing.CreatedAt,
		&billing.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		// Return empty billing info if not found
		return &domain.BillingInfo{CompanyID: companyID}, nil
	}
	return billing, err
}

func (r *companyRepository) UpdateBillingInfo(ctx context.Context, billing *domain.BillingInfo) error {
	query := `
		INSERT INTO auth_schema.billing_info (company_id, card_holder_name, card_number_masked, expiration_date, card_type, tokens_used, tokens_limit, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (company_id) DO UPDATE SET
			card_holder_name = EXCLUDED.card_holder_name,
			card_number_masked = EXCLUDED.card_number_masked,
			expiration_date = EXCLUDED.expiration_date,
			card_type = EXCLUDED.card_type,
			tokens_used = EXCLUDED.tokens_used,
			tokens_limit = EXCLUDED.tokens_limit,
			updated_at = NOW()
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		billing.CompanyID,
		billing.CardHolderName,
		billing.CardNumberMasked,
		billing.ExpirationDate,
		billing.CardType,
		billing.TokensUsed,
		billing.TokensLimit,
	)
	return err
}
