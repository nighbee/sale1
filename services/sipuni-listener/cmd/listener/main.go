package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/url"
	"os"
	"os/signal"
	"time"

	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"github.com/salesai/sipuni-listener/internal/adapters/queue"
	"github.com/salesai/sipuni-listener/internal/adapters/repositories"
	"github.com/salesai/sipuni-listener/internal/core/domain"
	applogger "github.com/salesai/sipuni-listener/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type SipuniAuthBody struct {
	Key string `json:"key"`
}

type SipuniAuthMessage struct {
	Type string         `json:"type"`
	Body SipuniAuthBody `json:"body"`
}

type SipuniEvent struct {
	Action  string          `json:"action"`
	Request json.RawMessage `json:"request"`
	Status  int             `json:"status"`
}

type SipuniNotifyRequest struct {
	CallID              string      `json:"call_id"`
	Event               json.Number `json:"event"`
	DstNum              string      `json:"dst_num"`
	SrcNum              string      `json:"src_num"`
	SrcType             int         `json:"src_type"`
	DstType             int         `json:"dst_type"`
	Timestamp           json.Number `json:"timestamp"`
	UserID              string      `json:"user_id"`
	User                string      `json:"user"`
	Status              string      `json:"status"`
	CallStartTimestamp  json.Number `json:"call_start_timestamp"`
	CallAnswerTimestamp json.Number `json:"call_answer_timestamp"`
	CallRecordLink      string      `json:"call_record_link"`
	TreeName            string      `json:"treeName"`
}

var (
	publisher *queue.BullMQPublisher
	callRepo  repositories.CallRepository
)

func main() {
	applogger.Init("sipuni-listener")
	defer applogger.Sync()
	log := applogger.L

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://redis:6379"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("database connection failed", zap.Error(err))
	}
	defer db.Close()
	log.Info("PostgreSQL connected")

	callRepo = repositories.NewCallRepository(db)

	publisher, err = queue.NewBullMQPublisher(redisURL)
	if err != nil {
		log.Fatal("redis publisher init failed", zap.Error(err))
	}
	log.Info("BullMQ publisher ready", zap.String("redis_url", redisURL))

	// Start a simple HTTP server for metrics
	go func() {
		app := fiber.New()
		prometheus := fiberprometheus.New("sipuni-listener")
		prometheus.RegisterAt(app, "/metrics")
		app.Use(prometheus.Middleware)

		port := os.Getenv("PORT")
		if port == "" {
			port = "8081"
		}
		log.Info("Metrics server starting", zap.String("port", port))
		if err := app.Listen(":" + port); err != nil {
			log.Error("Metrics server error", zap.Error(err))
		}
	}()

	u := url.URL{Scheme: "wss", Host: "wss.sipuni.com", Path: "/api"}
	apiKey := os.Getenv("SIPUNI_API_KEY")

	backoff := 2 * time.Second
	maxBackoff := 60 * time.Second
	retryCount := 0

	for {
		log.Info("Connecting to Sipuni WebSocket", zap.String("url", u.String()), zap.Int("retry_count", retryCount))
		c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
		if err != nil {
			log.Warn("WebSocket dial error, will retry",
				zap.Error(err), zap.Duration("backoff", backoff), zap.Int("retry_count", retryCount))
			retryCount++
			select {
			case <-interrupt:
				log.Info("Interrupt received during reconnect, shutting down")
				return
			case <-time.After(backoff):
				backoff *= 2
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
				continue
			}
		}

		// Connected successfully
		backoff = 2 * time.Second
		retryCount = 0
		log.Info("Connected to Sipuni WebSocket server")

		// Auth
		authMsg := SipuniAuthMessage{
			Type: "auth",
			Body: SipuniAuthBody{Key: apiKey},
		}
		if err := c.WriteJSON(authMsg); err != nil {
			log.Error("auth send error", zap.Error(err))
			c.Close()
			continue
		}
		log.Info("Authentication message sent to Sipuni")

		// Keepalive goroutine
		keepaliveStop := make(chan struct{})
		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					keepalive := map[string]string{"type": "keepalive"}
					if err := c.WriteJSON(keepalive); err != nil {
						log.Warn("keepalive send error", zap.Error(err))
						return
					}
					log.Debug("keepalive sent")
				case <-keepaliveStop:
					return
				}
			}
		}()

		// Listen loop
		done := make(chan struct{})
		go func() {
			defer close(done)
			defer close(keepaliveStop)
			for {
				_, message, err := c.ReadMessage()
				if err != nil {
					log.Warn("WebSocket read error", zap.Error(err))
					return
				}

				log.Info("Message received from Sipuni", zap.String("raw", string(message)))

				// Try to parse as event message (notify or auth response)
				var event SipuniEvent
				err = json.Unmarshal(message, &event)
				if err == nil {
					// Handle auth response
					if event.Action == "auth" {
						if event.Status == 1 {
							log.Info("Sipuni authentication successful — waiting for events")
						} else {
							log.Error("Sipuni authentication failed",
								zap.Int("status", event.Status), zap.String("raw", string(message)))
						}
						continue
					}

					// Handle notify message
					if event.Action == "notify" {
						log.Info("Sipuni notify event received",
							zap.String("raw", string(message)))
						handleNotify(event.Request)
						continue
					}
				}

				// Fallback: Try to parse as direct notify request (unwrapped)
				var directNotify SipuniNotifyRequest
				err = json.Unmarshal(message, &directNotify)
				if err == nil && directNotify.CallID != "" {
					log.Info("received direct notify (unwrapped)",
						zap.String("call_id", directNotify.CallID))
					// We need to re-marshal to RawMessage to use existing handleNotify
					rawRequest, _ := json.Marshal(directNotify)
					handleNotify(rawRequest)
					continue
				}

				log.Debug("unrecognized message format", zap.String("raw", string(message)))
			}
		}()

		select {
		case <-done:
			log.Warn("Listen loop terminated, reconnecting")
			c.Close()
		case <-interrupt:
			log.Info("Interrupt received, closing WebSocket connection")
			c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			c.Close()
			return
		}
	}
}

func handleNotify(request json.RawMessage) {
	log := applogger.L.With(zap.String("operation", "handle_notify"))
	var notify SipuniNotifyRequest
	if err := json.Unmarshal(request, &notify); err != nil {
		log.Error("unmarshal notify error", zap.Error(err))
		return
	}

	// Unify UserID and User
	managerID := notify.UserID
	if managerID == "" {
		managerID = notify.User
	}

	log.Info("processing Sipuni notify",
		zap.String("sipuni_call_id", notify.CallID),
		zap.String("event", notify.Event.String()),
		zap.String("status", notify.Status),
		zap.String("src_num", notify.SrcNum),
		zap.Int("src_type", notify.SrcType),
		zap.String("dst_num", notify.DstNum),
		zap.Bool("has_recording", notify.CallRecordLink != ""))

	// Only process answered calls — NOANSWER/BUSY/FAILED/CANCEL have no actual audio
	if notify.Status != "ANSWER" {
		log.Info("skipping notify — call not answered",
			zap.String("sipuni_call_id", notify.CallID),
			zap.String("status", notify.Status))
		return
	}

	// We only care about calls with a record link
	if notify.CallRecordLink == "" {
		log.Info("skipping notify — no recording link despite ANSWER status",
			zap.String("sipuni_call_id", notify.CallID))
		return
	}

	callID := uuid.New().String()

	// Parse timestamps.
	// Talk duration = hang-up timestamp − answer timestamp (not start timestamp,
	// which would include ring time).
	startTime, _ := notify.CallStartTimestamp.Int64()
	answerTime, _ := notify.CallAnswerTimestamp.Int64()
	endTime, _ := notify.Timestamp.Int64()

	talkDuration := int(endTime - answerTime)
	if talkDuration <= 0 {
		talkDuration = 1
	}

	callDate := time.Unix(startTime, 0)

	// Determine client phone using src_type / dst_type:
	//   src_type=1 means the caller is external (incoming call scenario)
	//   dst_type=1 means the destination is external (outbound call scenario)
	var clientPhone string
	if notify.SrcType == 1 {
		// Incoming: external caller → internal operator
		clientPhone = notify.SrcNum
	} else if notify.DstType == 1 {
		// Outbound: internal operator → external client
		clientPhone = notify.DstNum
	} else {
		// Fallback: both internal — use length heuristic
		clientPhone = notify.SrcNum
		if len(notify.DstNum) > len(notify.SrcNum) {
			clientPhone = notify.DstNum
		}
	}

	// call_record_link is URL-encoded per Sipuni docs — decode before storing.
	recordLink, err := url.QueryUnescape(notify.CallRecordLink)
	if err != nil {
		// If decoding fails keep the raw value
		recordLink = notify.CallRecordLink
	}

	call := &domain.Call{
		ID:          callID,
		ManagerID:   notify.UserID,
		ManagerName: "Sipuni Manager",
		ClientPhone: clientPhone,
		Duration:    talkDuration,
		CallLink:    recordLink,
		CallDate:    callDate,
		CallTime:    callDate,
		Status:      domain.StatusPending,
		Source:      "sipuni",
	}

	if err := callRepo.Create(context.Background(), call); err != nil {
		log.Error("database error saving call",
			zap.String("call_id", callID), zap.Error(err))
		return
	}
	log.Info("call record created",
		zap.String("call_id", callID), zap.String("manager_id", notify.UserID),
		zap.String("client_phone", clientPhone), zap.Int("duration_s", talkDuration))

	job := queue.AudioProcessingJob{
		CallID:    callID,
		AudioURL:  recordLink,
		ManagerID: notify.UserID,
	}

	if err := publisher.EnqueueAudioProcessing(context.Background(), job); err != nil {
		log.Error("queue error enqueuing audio job",
			zap.String("call_id", callID), zap.Error(err))
	} else {
		log.Info("audio processing job enqueued",
			zap.String("call_id", callID), zap.String("audio_url", notify.CallRecordLink))
	}
}
