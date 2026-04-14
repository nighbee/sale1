package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/salesai/sipuni-listener/internal/core/ports"
)

const (
	NotifyQueueKey = "notify_queue"
	LockKeyPrefix  = "lock:sipuni:company:"
)

type BullMQPublisher struct {
	client *redis.Client
}

func NewBullMQPublisher(redisURL string) (ports.QueuePublisher, error) {
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
	CompanyID  string `json:"company_id"`
	AudioURL   string `json:"audio_url"`
	ManagerID  string `json:"manager_id"`
	RetryCount int    `json:"retry_count"`
	MaxRetries int    `json:"max_retries"`
}

func (p *BullMQPublisher) EnqueueAudioProcessing(ctx context.Context, callID string, audioURL string, managerID string, companyID string) error {
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

type SipuniEventJob struct {
	CompanyID string          `json:"company_id"`
	Payload   json.RawMessage `json:"payload"`
}

func (p *BullMQPublisher) EnqueueSipuniEvent(ctx context.Context, companyID string, payload []byte) error {
	job := SipuniEventJob{
		CompanyID: companyID,
		Payload:   payload,
	}
	data, err := json.Marshal(job)
	if err != nil {
		return err
	}
	return p.client.RPush(ctx, NotifyQueueKey, data).Err()
}

func (p *BullMQPublisher) DequeueSipuniEvent(ctx context.Context) (string, []byte, error) {
	res, err := p.client.BLPop(ctx, 0, NotifyQueueKey).Result()
	if err != nil {
		return "", nil, err
	}
	if len(res) < 2 {
		return "", nil, fmt.Errorf("invalid blpop result")
	}

	var job SipuniEventJob
	if err := json.Unmarshal([]byte(res[1]), &job); err != nil {
		return "", nil, err
	}

	return job.CompanyID, job.Payload, nil
}

func (p *BullMQPublisher) TryLockCompany(ctx context.Context, companyID string, instanceID string, ttl time.Duration) (bool, error) {
	key := LockKeyPrefix + companyID
	return p.client.SetNX(ctx, key, instanceID, ttl).Result()
}

func (p *BullMQPublisher) RefreshLockCompany(ctx context.Context, companyID string, instanceID string, ttl time.Duration) (bool, error) {
	key := LockKeyPrefix + companyID
	// Lua script to refresh lock only if it belongs to this instance
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("expire", KEYS[1], ARGV[2])
		else
			return 0
		end
	`
	res, err := p.client.Eval(ctx, script, []string{key}, instanceID, int(ttl.Seconds())).Result()
	if err != nil {
		return false, err
	}
	return res.(int64) == 1, nil
}

func (p *BullMQPublisher) ReleaseLockCompany(ctx context.Context, companyID string, instanceID string) error {
	key := LockKeyPrefix + companyID
	// Lua script to release lock only if it belongs to this instance
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	return p.client.Eval(ctx, script, []string{key}, instanceID).Err()
}
