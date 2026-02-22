package queue

import (
	"context"
	"encoding/json"
	"github.com/go-redis/redis/v8"
)

type BullMQPublisher struct {
	client *redis.Client
}

func NewBullMQPublisher(redisURL string) (*BullMQPublisher, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)
	return &BullMQPublisher{client: client}, nil
}

type AudioProcessingJob struct {
	JobType    string `json:"job_type"`
	CallID     string `json:"call_id"`
	AudioURL   string `json:"audio_url"`
	ManagerID  string `json:"manager_id"`
	RetryCount int    `json:"retry_count"`
	MaxRetries int    `json:"max_retries"`
}

func (p *BullMQPublisher) EnqueueAudioProcessing(ctx context.Context, job AudioProcessingJob) error {
	job.JobType = "audio_processing"
	job.MaxRetries = 3

	data, err := json.Marshal(job)
	if err != nil {
		return err
	}

	return p.client.RPush(ctx, "bullmq:audio_processing", data).Err()
}
