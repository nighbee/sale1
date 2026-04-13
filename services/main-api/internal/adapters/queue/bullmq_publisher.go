package queue

import (
	"context"
	"encoding/json"
	"fmt"

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
	CompanyID  string `json:"company_id"`
	AudioURL   string `json:"audio_url"`
	ManagerID  string `json:"manager_id"`
	RetryCount int    `json:"retry_count"`
	MaxRetries int    `json:"max_retries"`
}

func (p *BullMQPublisher) EnqueueAudioProcessing(ctx context.Context, callID string, audioURL string, managerID string, companyID string) error {
	paused, _ := p.IsQueuePaused(ctx, companyID)
	if paused {
		return fmt.Errorf("queue is currently paused for this tenant")
	}

	job := AudioProcessingJob{
		JobType:    "audio_processing",
		CallID:     callID,
		CompanyID:  companyID,
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

func (p *BullMQPublisher) PauseQueue(ctx context.Context, companyID string) error {
	return p.client.Set(ctx, "queue:paused:"+companyID, "true", 0).Err()
}

func (p *BullMQPublisher) ResumeQueue(ctx context.Context, companyID string) error {
	return p.client.Del(ctx, "queue:paused:"+companyID).Err()
}

func (p *BullMQPublisher) IsQueuePaused(ctx context.Context, companyID string) (bool, error) {
	val, err := p.client.Get(ctx, "queue:paused:"+companyID).Result()
	if err == redis.Nil {
		return false, nil
	}
	return val == "true", err
}

func (p *BullMQPublisher) GetQueueItems(ctx context.Context, companyID string) ([]map[string]interface{}, error) {
	// Sample first 500 items to avoid blocking Redis on very large queues
	items, err := p.client.LRange(ctx, "bullmq:audio_processing", 0, 499).Result()
	if err != nil {
		return nil, err
	}

	result := []map[string]interface{}{}
	for _, item := range items {
		var job AudioProcessingJob
		if err := json.Unmarshal([]byte(item), &job); err == nil {
			if job.CompanyID == companyID {
				result = append(result, map[string]interface{}{
					"raw":    item,
					"parsed": job,
				})
			}
		}
	}
	return result, nil
}

func (p *BullMQPublisher) DeleteQueueItem(ctx context.Context, companyID string, rawItem string) error {
	// To safely delete from Redis list, we need the exact raw string
	// We also verify company_id from the parsed version before deleting
	var job AudioProcessingJob
	if err := json.Unmarshal([]byte(rawItem), &job); err != nil {
		return err
	}

	if job.CompanyID != companyID {
		return fmt.Errorf("unauthorized: item does not belong to company")
	}

	return p.client.LRem(ctx, "bullmq:audio_processing", 1, rawItem).Err()
}

func (p *BullMQPublisher) UpdateQueueItem(ctx context.Context, companyID string, oldRaw string, newRaw string) error {
	// Verify company_id of BOTH items for safety
	var oldJob, newJob AudioProcessingJob
	if err := json.Unmarshal([]byte(oldRaw), &oldJob); err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(newRaw), &newJob); err != nil {
		return err
	}

	if oldJob.CompanyID != companyID || newJob.CompanyID != companyID {
		return fmt.Errorf("unauthorized: item does not belong to company")
	}

	// Redis LSET doesn't exist for "matching value", we must find index or use LREM + LINSERT/RPUSH
	// Since order might matter for priority but BullMQ uses it as a FIFO usually:
	// Let's do LREM then RPUSH as a simple "update" (move to end of queue with new data)
	err := p.client.LRem(ctx, "bullmq:audio_processing", 1, oldRaw).Err()
	if err != nil {
		return err
	}
	return p.client.RPush(ctx, "bullmq:audio_processing", newRaw).Err()
}
