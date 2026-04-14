package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

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
		INSERT INTO auth_schema.companies (id, name, description, industry, size, time_zone, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		company.ID, company.Name, company.Description, company.Industry, company.Size, company.TimeZone, company.IsActive,
	).Scan(&company.CreatedAt, &company.UpdatedAt)
}

func (r *companyRepository) GetByID(ctx context.Context, id string) (*domain.Company, error) {
	query := `
		SELECT id, name, COALESCE(description, ''), COALESCE(industry, ''), COALESCE(size, ''), managers_count, COALESCE(time_zone, ''), stt_model_preference, llm_provider, subscription_tier, is_active, created_at, updated_at
		FROM auth_schema.companies
		WHERE id = $1
	`
	c := &domain.Company{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Name, &c.Description, &c.Industry, &c.Size, &c.ManagersCount, &c.TimeZone, &c.STTModelPreference, &c.LLMProvider, &c.SubscriptionTier, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("company not found")
	}
	return c, err
}

func (r *companyRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.Company, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if search, ok := filters["search"].(string); ok && search != "" {
		where = append(where, "name ILIKE $"+strconv.Itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	limit := 20
	if l, ok := filters["limit"].(int); ok && l > 0 {
		limit = l
	}
	page := 1
	if p, ok := filters["page"].(int); ok && p > 0 {
		page = p
	}
	offset := (page - 1) * limit

	query := fmt.Sprintf(`
		SELECT id, name, COALESCE(description, ''), COALESCE(industry, ''), COALESCE(size, ''), managers_count, COALESCE(time_zone, ''), stt_model_preference, llm_provider, subscription_tier, is_active, created_at, updated_at
		FROM auth_schema.companies
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), argIdx, argIdx+1)

	rows, err := r.db.QueryContext(ctx, query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var companies []*domain.Company
	for rows.Next() {
		c := &domain.Company{}
		err := rows.Scan(
			&c.ID, &c.Name, &c.Description, &c.Industry, &c.Size, &c.ManagersCount, &c.TimeZone, &c.STTModelPreference, &c.LLMProvider, &c.SubscriptionTier, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		companies = append(companies, c)
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM auth_schema.companies WHERE %s", strings.Join(where, " AND "))
	var total int
	err = r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return companies, total, nil
}

func (r *companyRepository) Update(ctx context.Context, company *domain.Company) error {
	query := `
		UPDATE auth_schema.companies
		SET name = $2, description = $3, industry = $4, size = $5, managers_count = $6, time_zone = $7, stt_model_preference = $8, llm_provider = $9, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query,
		company.ID, company.Name, company.Description, company.Industry, company.Size, company.ManagersCount, company.TimeZone, company.STTModelPreference, company.LLMProvider,
	)
	return err
}

func (r *companyRepository) GetBillingInfo(ctx context.Context, companyID string) (*domain.BillingInfo, error) {
	query := `
		SELECT company_id, COALESCE(card_holder_name, ''), COALESCE(card_number_masked, ''), COALESCE(expiration_date, ''), COALESCE(card_type, ''), tokens_used, tokens_limit, COALESCE(stripe_customer_id, ''), COALESCE(stripe_payment_method_id, ''), created_at, updated_at
		FROM auth_schema.billing_info
		WHERE company_id = $1
	`
	billing := &domain.BillingInfo{}
	err := r.db.QueryRowContext(ctx, query, companyID).Scan(
		&billing.ID,
		&billing.CardHolderName,
		&billing.CardNumberMasked,
		&billing.ExpirationDate,
		&billing.CardType,
		&billing.TokensUsed,
		&billing.TokensLimit,
		&billing.StripeCustomerID,
		&billing.StripePaymentMethodID,
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
	query := `
		INSERT INTO auth_schema.billing_info (company_id, card_holder_name, card_number_masked, expiration_date, card_type, tokens_used, tokens_limit, stripe_customer_id, stripe_payment_method_id, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		ON CONFLICT (company_id) DO UPDATE SET
			card_holder_name = COALESCE(NULLIF(EXCLUDED.card_holder_name, ''), auth_schema.billing_info.card_holder_name),
			card_number_masked = COALESCE(NULLIF(EXCLUDED.card_number_masked, ''), auth_schema.billing_info.card_number_masked),
			expiration_date = COALESCE(NULLIF(EXCLUDED.expiration_date, ''), auth_schema.billing_info.expiration_date),
			card_type = COALESCE(NULLIF(EXCLUDED.card_type, ''), auth_schema.billing_info.card_type),
			tokens_used = EXCLUDED.tokens_used,
			tokens_limit = EXCLUDED.tokens_limit,
			stripe_customer_id = COALESCE(NULLIF(EXCLUDED.stripe_customer_id, ''), auth_schema.billing_info.stripe_customer_id),
			stripe_payment_method_id = COALESCE(NULLIF(EXCLUDED.stripe_payment_method_id, ''), auth_schema.billing_info.stripe_payment_method_id),
			updated_at = NOW()
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		billing.ID, // Assuming ID is company_id for billing_info as it's PK in migration
		billing.CardHolderName,
		billing.CardNumberMasked,
		billing.ExpirationDate,
		billing.CardType,
		billing.TokensUsed,
		billing.TokensLimit,
		billing.StripeCustomerID,
		billing.StripePaymentMethodID,
	)
	return err
}
