package queue

import (
	"context"
	"encoding/json"

	"github.com/go-redis/redis/v8"
	"github.com/salesai/main-api/internal/core/ports"
)

type BullMQPublisher struct {
	client *redis.Client
}

func NewBullMQPublisher(client *redis.Client) ports.QueuePublisher {
	return &BullMQPublisher{client: client}
}

type AudioProcessingJob struct {
	JobType    string `json:"job_type"`
	CallID     string `json:"call_id"`
	AudioURL   string `json:"audio_url"`
	ManagerID  string `json:"manager_id"`
	RetryCount int    `json:"retry_count"`
	MaxRetries int    `json:"max_retries"`
}

func (p *BullMQPublisher) EnqueueAudioProcessing(ctx context.Context, callID string, audioURL string, managerID string) error {
	job := AudioProcessingJob{
		JobType:    "audio_processing",
		CallID:     callID,
		AudioURL:   audioURL,
		ManagerID:  managerID,
		MaxRetries: 3,
	}

	data, err := json.Marshal(job)
	if err != nil {
		return err
	}

	return p.client.RPush(ctx, "bullmq:audio_processing", data).Err()
}
