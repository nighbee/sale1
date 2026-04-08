package payment

import (
	"context"
	"fmt"

	"github.com/salesai/main-api/internal/core/ports"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/customer"
	"github.com/stripe/stripe-go/v72/setupintent"
)

type stripeAdapter struct {
	secretKey string
}

func NewStripeAdapter(secretKey string) ports.PaymentProvider {
	stripe.Key = secretKey
	return &stripeAdapter{
		secretKey: secretKey,
	}
}

func (a *stripeAdapter) CreateCustomer(ctx context.Context, email, name string) (string, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(name),
	}
	c, err := customer.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create stripe customer: %w", err)
	}
	return c.ID, nil
}

func (a *stripeAdapter) CreateSetupIntent(ctx context.Context, customerID string) (string, string, error) {
	params := &stripe.SetupIntentParams{
		Customer: stripe.String(customerID),
		Usage:    stripe.String(string(stripe.SetupIntentUsageOffSession)),
	}
	si, err := setupintent.New(params)
	if err != nil {
		return "", "", fmt.Errorf("failed to create stripe setup intent: %w", err)
	}
	return si.ID, si.ClientSecret, nil
}
