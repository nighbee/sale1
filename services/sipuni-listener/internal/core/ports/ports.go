package ports

import (
	"context"
	"time"

	"github.com/salesai/sipuni-listener/internal/core/domain"
)

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
}

type UserRepository interface {
	FindByManagerID(ctx context.Context, managerID string, companyID string) (*domain.User, error)
	FindBySrcNum(ctx context.Context, srcNum string, companyID string) (*domain.User, error)
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	Create(ctx context.Context, user *domain.User) error
}

type QueuePublisher interface {
	EnqueueAudioProcessing(ctx context.Context, jobID string, audioURL string, managerID string, companyID string) error
	EnqueueSipuniEvent(ctx context.Context, companyID string, payload []byte) error
	DequeueSipuniEvent(ctx context.Context) (string, []byte, error)
	TryLockCompany(ctx context.Context, companyID string, instanceID string, ttl time.Duration) (bool, error)
	RefreshLockCompany(ctx context.Context, companyID string, instanceID string, ttl time.Duration) (bool, error)
	ReleaseLockCompany(ctx context.Context, companyID string, instanceID string) error
}
