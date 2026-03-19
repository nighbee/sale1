package ports

import (
	"context"
	"github.com/salesai/sipuni-listener/internal/core/domain"
)

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
}

type QueuePublisher interface {
	EnqueueAudioProcessing(ctx context.Context, jobID string, audioURL string, managerID string) error
}
