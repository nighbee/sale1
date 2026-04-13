package ports

import "context"

type QueuePublisher interface {
	EnqueueAudioProcessing(ctx context.Context, callID string, audioURL string, managerID string, companyID string) error
	PauseQueue(ctx context.Context, companyID string) error
	ResumeQueue(ctx context.Context, companyID string) error
	IsQueuePaused(ctx context.Context, companyID string) (bool, error)
	GetQueueItems(ctx context.Context, companyID string) ([]map[string]interface{}, error)
	DeleteQueueItem(ctx context.Context, companyID string, itemID string) error
	UpdateQueueItem(ctx context.Context, companyID string, oldRaw string, newRaw string) error
}
