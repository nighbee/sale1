package billing

import (
	"context"
	"fmt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type BillingUseCase struct {
	companyRepo ports.CompanyRepository
	userRepo    ports.UserRepository
	payment     ports.PaymentProvider
}

func NewBillingUseCase(
	companyRepo ports.CompanyRepository,
	userRepo ports.UserRepository,
	payment ports.PaymentProvider,
) *BillingUseCase {
	return &BillingUseCase{
		companyRepo: companyRepo,
		userRepo:    userRepo,
		payment:     payment,
	}
}

func (uc *BillingUseCase) CreateSetupIntent(ctx context.Context, companyID string, userID string) (string, string, error) {
	company, err := uc.companyRepo.GetByID(ctx, companyID)
	if err != nil {
		return "", "", fmt.Errorf("failed to get company: %w", err)
	}

	billing, err := uc.companyRepo.GetBillingInfo(ctx, companyID)
	if err != nil {
		return "", "", fmt.Errorf("failed to get billing info: %w", err)
	}

	if billing.StripeCustomerID == "" {
		user, err := uc.userRepo.GetByID(ctx, userID)
		if err != nil {
			return "", "", fmt.Errorf("failed to get user: %w", err)
		}

		customerID, err := uc.payment.CreateCustomer(ctx, user.Email, company.Name)
		if err != nil {
			return "", "", fmt.Errorf("failed to create stripe customer: %w", err)
		}

		billing.StripeCustomerID = customerID
		billing.ID = companyID
		if err := uc.companyRepo.UpdateBillingInfo(ctx, billing); err != nil {
			return "", "", fmt.Errorf("failed to update billing info with customer id: %w", err)
		}
	}

	return uc.payment.CreateSetupIntent(ctx, billing.StripeCustomerID)
}

func (uc *BillingUseCase) UpdateBilling(ctx context.Context, companyID string, update *domain.BillingInfo) (*domain.BillingInfo, error) {
	current, err := uc.companyRepo.GetBillingInfo(ctx, companyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current billing info: %w", err)
	}

	// Update only allowed fields
	current.CardHolderName = update.CardHolderName
	current.CardNumberMasked = update.CardNumberMasked
	current.ExpirationDate = update.ExpirationDate
	current.CardType = update.CardType

	current.ID = companyID
	if err := uc.companyRepo.UpdateBillingInfo(ctx, current); err != nil {
		return nil, err
	}
	return current, nil
}

func (uc *BillingUseCase) GetBilling(ctx context.Context, companyID string) (*domain.BillingInfo, error) {
	return uc.companyRepo.GetBillingInfo(ctx, companyID)
}
