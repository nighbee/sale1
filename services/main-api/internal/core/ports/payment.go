package ports

import "context"

type PaymentProvider interface {
	CreateCustomer(ctx context.Context, email, name string) (string, error)
	CreateSetupIntent(ctx context.Context, customerID string) (string, string, error)
}
