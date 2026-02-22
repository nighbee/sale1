package events

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/salesai/main-api/internal/adapters/http/ws"
	"github.com/salesai/main-api/internal/core/ports"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type RedisConsumer struct {
	client          *redis.Client
	hub             *ws.Hub
	callRepo        ports.CallRepository
	userRepo        ports.UserRepository
	integrationRepo ports.IntegrationRepository
}

func NewRedisConsumer(
	client *redis.Client,
	hub *ws.Hub,
	callRepo ports.CallRepository,
	userRepo ports.UserRepository,
	integrationRepo ports.IntegrationRepository,
) *RedisConsumer {
	return &RedisConsumer{
		client:          client,
		hub:             hub,
		callRepo:        callRepo,
		userRepo:        userRepo,
		integrationRepo: integrationRepo,
	}
}

func (c *RedisConsumer) Start(ctx context.Context) {
	log := applogger.With(zap.String("component", "redis_consumer"))
	streams := []string{"analysis_completed", "critical_error"}
	groupName := "main_api_group"
	consumerName := "main_api_consumer_1"

	// Initial group creation
	c.ensureGroups(ctx, streams, groupName)
	log.Info("Redis consumer started", zap.Strings("streams", streams), zap.String("group", groupName))

	for {
		entries, err := c.client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    groupName,
			Consumer: consumerName,
			Streams:  []string{"analysis_completed", "critical_error", ">", ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err != redis.Nil {
				log.Error("Redis read error", zap.Error(err))
				// If error is NOGROUP, try to recreate groups
				if err.Error() == "NOGROUP No such key 'analysis_completed' or consumer group 'main_api_group' in XREADGROUP with GROUP option" ||
					err.Error() == "NOGROUP No such key 'critical_error' or consumer group 'main_api_group' in XREADGROUP with GROUP option" {
					log.Warn("Consumer group missing, attempting to recreate")
					c.ensureGroups(ctx, streams, groupName)
				}
				time.Sleep(2 * time.Second)
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
					log.Error("unmarshal payload error", zap.String("stream", streamName), zap.Error(err))
					continue
				}

				callID, _ := payload["call_id"].(string)
				log.Info("processing Redis event",
					zap.String("stream", streamName),
					zap.String("call_id", callID),
					zap.String("message_id", message.ID))

				if streamName == "analysis_completed" {
					if err := c.callRepo.UpdateStatus(ctx, callID, "completed"); err != nil {
						log.Error("failed to update call status to completed", zap.String("call_id", callID), zap.Error(err))
					}
					call, err := c.callRepo.GetByIDInternal(ctx, callID)
					if err == nil {
						user, err := c.userRepo.GetByManagerID(ctx, call.ManagerID)
						if err == nil {
							c.hub.Broadcast(ws.Message{
								UserID:    call.ManagerID,
								CompanyID: user.CompanyID,
								Type:      "analysis_completed",
								Payload:   payload,
							})
							// External Notifications
							go c.notifyExternal(ctx, user.CompanyID, "Call Analysis Completed", fmt.Sprintf("Call with %s completed. Rating: %v", call.ClientPhone, payload["overall_rating"]))
						}
					}
				} else if streamName == "critical_error" {
					call, err := c.callRepo.GetByIDInternal(ctx, callID)
					if err == nil {
						user, err := c.userRepo.GetByManagerID(ctx, call.ManagerID)
						if err == nil {
							// Broadcast to everyone in the company (admins)
							c.hub.Broadcast(ws.Message{
								CompanyID: user.CompanyID,
								Type:      "critical_error",
								Payload:   payload,
							})
							// External Notifications
							go c.notifyExternal(ctx, user.CompanyID, "CRITICAL ERROR", fmt.Sprintf("%v", payload["message"]))
						}
					}
				}

				c.client.XAck(ctx, streamName, groupName, message.ID)
			}
		}
	}
}

func (c *RedisConsumer) notifyExternal(ctx context.Context, companyID, subject, message string) {
	integrations, err := c.integrationRepo.ListByCompany(ctx, companyID)
	if err != nil {
		return
	}

	for _, intg := range integrations {
		if !intg.IsActive {
			continue
		}

		var creds map[string]interface{}
		json.Unmarshal(intg.Credentials, &creds)

		var config map[string]interface{}
		json.Unmarshal(intg.Config, &config)

		switch intg.IntegrationType {
		case "slack":
			webhookURL, _ := creds["webhook_url"].(string)
			if webhookURL != "" {
				payload := map[string]string{"text": fmt.Sprintf("*%s*\n%s", subject, message)}
				body, _ := json.Marshal(payload)
				http.Post(webhookURL, "application/json", bytes.NewBuffer(body))
			}
		case "telegram":
			botToken, _ := creds["bot_token"].(string)
			chatID, _ := config["chat_id"].(string)
			if botToken != "" && chatID != "" {
				apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
				payload := map[string]string{
					"chat_id":    chatID,
					"text":       fmt.Sprintf("<b>%s</b>\n%s", subject, message),
					"parse_mode": "HTML",
				}
				body, _ := json.Marshal(payload)
				http.Post(apiURL, "application/json", bytes.NewBuffer(body))
			}
		}
	}
}

func (c *RedisConsumer) ensureGroups(ctx context.Context, streams []string, groupName string) {
	log := applogger.With(zap.String("component", "redis_consumer"))
	for _, stream := range streams {
		err := c.client.XGroupCreateMkStream(ctx, stream, groupName, "0").Err()
		if err != nil {
			if err.Error() == "BUSYGROUP Consumer Group name already exists" {
				continue
			}
			log.Error("XGroupCreate error", zap.String("stream", stream), zap.Error(err))
		} else {
			log.Info("Consumer group created", zap.String("group", groupName), zap.String("stream", stream))
		}
	}
}
