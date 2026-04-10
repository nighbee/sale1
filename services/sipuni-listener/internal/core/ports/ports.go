package ports

import (
	"context"
	"github.com/salesai/sipuni-listener/internal/core/domain"
)

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
}

type UserRepository interface {
	FindByManagerID(ctx context.Context, managerID string, companyID string) (*domain.User, error)
	FindBySrcNum(ctx context.Context, srcNum string, companyID string) (*domain.User, error)
	Create(ctx context.Context, user *domain.User) error
}

type QueuePublisher interface {
	EnqueueAudioProcessing(ctx context.Context, jobID string, audioURL string, managerID string, companyID string) error
}
