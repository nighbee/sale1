package repositories

import (
	"context"
	"database/sql"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type companyRepository struct {
	db *sql.DB
}

func NewCompanyRepository(db *sql.DB) ports.CompanyRepository {
	return &companyRepository{db: db}
}

func (r *companyRepository) GetBillingInfo(ctx context.Context) (*domain.BillingInfo, error) {
	query := `
		SELECT id, card_holder_name, card_number_masked, expiration_date, card_type, tokens_used, tokens_limit, created_at, updated_at
		FROM auth_schema.billing_info
		LIMIT 1
	`
	billing := &domain.BillingInfo{}
	err := r.db.QueryRowContext(ctx, query).Scan(
		&billing.ID,
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
		return &domain.BillingInfo{}, nil
	}
	return billing, err
}

func (r *companyRepository) UpdateBillingInfo(ctx context.Context, billing *domain.BillingInfo) error {
	// For single company, we just update the first row or insert it
	query := `
		INSERT INTO auth_schema.billing_info (id, card_holder_name, card_number_masked, expiration_date, card_type, tokens_used, tokens_limit, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (id) DO UPDATE SET
			card_holder_name = EXCLUDED.card_holder_name,
			card_number_masked = EXCLUDED.card_number_masked,
			expiration_date = EXCLUDED.expiration_date,
			card_type = EXCLUDED.card_type,
			tokens_used = EXCLUDED.tokens_used,
			tokens_limit = EXCLUDED.tokens_limit,
			updated_at = NOW()
	`
	if billing.ID == "" {
		billing.ID = "00000000-0000-0000-0000-000000000001" // Static ID for global settings
	}
	_, err := r.db.ExecContext(
		ctx,
		query,
		billing.ID,
		billing.CardHolderName,
		billing.CardNumberMasked,
		billing.ExpirationDate,
		billing.CardType,
		billing.TokensUsed,
		billing.TokensLimit,
	)
	return err
}
