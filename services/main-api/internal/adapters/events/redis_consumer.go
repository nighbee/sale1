package events

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/salesai/main-api/internal/adapters/http/ws"
	"github.com/salesai/main-api/internal/core/ports"
)

type RedisConsumer struct {
	client   *redis.Client
	hub      *ws.Hub
	callRepo ports.CallRepository
}

func NewRedisConsumer(client *redis.Client, hub *ws.Hub, callRepo ports.CallRepository) *RedisConsumer {
	return &RedisConsumer{
		client:   client,
		hub:      hub,
		callRepo: callRepo,
	}
}

func (c *RedisConsumer) Start(ctx context.Context) {
	streams := []string{"analysis_completed", "critical_error"}
	groupName := "main_api_group"
	consumerName := "main_api_consumer_1"

	// Create groups
	for _, stream := range streams {
		err := c.client.XGroupCreateMkStream(ctx, stream, groupName, "0").Err()
		if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
			log.Printf("XGroupCreate error for %s: %v", stream, err)
		}
	}

	for {
		entries, err := c.client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    groupName,
			Consumer: consumerName,
			Streams:  append(streams, ">", ">"), // Wait, syntax is streams then positions
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err != redis.Nil {
				log.Printf("Redis error: %v", err)
			}
			continue
		}

		for _, entry := range entries {
			streamName := entry.Stream
			for _, message := range entry.Messages {
				payloadStr, ok := message.Values["payload"].(string)
				if !ok {
					continue
				}

				var payload map[string]interface{}
				if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
					log.Printf("Unmarshal error: %v", err)
					continue
				}

				callID, _ := payload["call_id"].(string)
				companyID, _ := payload["company_id"].(string)

				if streamName == "analysis_completed" {
					call, err := c.callRepo.GetByIDInternal(ctx, callID)
					if err == nil {
						c.hub.Broadcast(ws.Message{
							UserID:    call.ManagerID,
							CompanyID: call.CompanyID,
							Type:      "analysis_completed",
							Payload:   payload,
						})
					}
				} else if streamName == "critical_error" {
					// Broadcast to everyone in the company (admins)
					c.hub.Broadcast(ws.Message{
						CompanyID: companyID,
						Type:      "critical_error",
						Payload:   payload,
					})
				}

				c.client.XAck(ctx, streamName, groupName, message.ID)
			}
		}
	}
}
