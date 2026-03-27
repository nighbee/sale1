package ports

import "context"

type QueuePublisher interface {
	EnqueueAudioProcessing(ctx context.Context, callID string, audioURL string, managerID string) error
}
