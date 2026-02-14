package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/url"
	"os"
	"strconv"
	"os/signal"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"github.com/salesai/sipuni-listener/internal/adapters/queue"
	"github.com/salesai/sipuni-listener/internal/adapters/repositories"
	"github.com/salesai/sipuni-listener/internal/core/domain"
)

type SipuniAuthBody struct {
	Key string `json:"key"`
}

type SipuniAuthMessage struct {
	Type string         `json:"type"`
	Body SipuniAuthBody `json:"body"`
}

type SipuniEvent struct {
	Type      string          `json:"type"`
	Action    string          `json:"action"`
	Namespace string          `json:"namespace"`
	Request   json.RawMessage `json:"request"`
}

type SipuniNotifyRequest struct {
	CallID             string `json:"call_id"`
	Event              int    `json:"event"`
	DstNum             string `json:"dst_num"`
	SrcNum             string `json:"src_num"`
	Timestamp          string `json:"timestamp"`
	UserID             string `json:"user_id"`
	Status             string `json:"status"`
	CallStartTimestamp string `json:"call_start_timestamp"`
	CallRecordLink     string `json:"call_record_link"`
	TreeName           string `json:"treeName"`
}

var (
	publisher *queue.BullMQPublisher
	callRepo  repositories.CallRepository
	companyID string
)

func main() {
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
		log.Fatal("database connection:", err)
	}
	defer db.Close()

	callRepo = repositories.NewCallRepository(db)

	// Resolve company ID from environment
	companyID = os.Getenv("COMPANY_ID")
	if companyID == "" {
		companyID = "550e8400-e29b-41d4-a716-446655440000"
	}

	publisher, err = queue.NewBullMQPublisher(redisURL)
	if err != nil {
		log.Fatal("redis publisher:", err)
	}

	u := url.URL{Scheme: "wss", Host: "wss.sipuni.com", Path: "/api"}
	apiKey := os.Getenv("SIPUNI_API_KEY")

	backoff := 2 * time.Second
	maxBackoff := 60 * time.Second

	for {
		log.Printf("Connecting to %s...", u.String())
		c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
		if err != nil {
			log.Printf("Dial error: %v. Retrying in %v...", err, backoff)
			select {
			case <-interrupt:
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
		log.Println("Connected to Sipuni WebSocket server.")

		// Auth
		authMsg := SipuniAuthMessage{
			Type: "auth",
			Body: SipuniAuthBody{Key: apiKey},
		}
		if err := c.WriteJSON(authMsg); err != nil {
			log.Printf("Auth send error: %v", err)
			c.Close()
			continue
		}
		log.Println("Authentication message sent.")

		// Listen loop
		done := make(chan struct{})
		go func() {
			defer close(done)
			for {
				_, message, err := c.ReadMessage()
				if err != nil {
					log.Printf("Read error: %v", err)
					return
				}

				log.Printf("Received raw message: %s", string(message))

				var event SipuniEvent
				if err := json.Unmarshal(message, &event); err == nil {
					if event.Action == "notify" && event.Namespace == "api" {
						handleNotify(event.Request)
					}
				}
			}
		}()

		select {
		case <-done:
			log.Println("Listen loop terminated. Reconnecting...")
			c.Close()
		case <-interrupt:
			log.Println("Interrupt received. Closing connection...")
			c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			c.Close()
			return
		}
	}
}

func handleNotify(request json.RawMessage) {
	var notify SipuniNotifyRequest
	if err := json.Unmarshal(request, &notify); err != nil {
		log.Println("Unmarshal notify error:", err)
		return
	}

	// We only care about calls with a record link
	if notify.CallRecordLink != "" {
		log.Printf("Received call event: ID=%s, Status=%s, Link=%s", notify.CallID, notify.Status, notify.CallRecordLink)

		callID := uuid.New().String()

		// Parse timestamps for duration
		startTime, _ := strconv.ParseInt(notify.CallStartTimestamp, 10, 64)
		endTime, _ := strconv.ParseInt(notify.Timestamp, 10, 64)
		duration := int(endTime - startTime)
		if duration <= 0 {
			duration = 1
		}

		callDate := time.Unix(startTime, 0)

		// Determine client phone (usually the longer one)
		clientPhone := notify.DstNum
		if len(notify.SrcNum) > len(notify.DstNum) {
			clientPhone = notify.SrcNum
		}

		call := &domain.Call{
			ID:          callID,
			CompanyID:   companyID,
			ManagerID:   notify.UserID,
			ManagerName: "Sipuni Manager",
			ClientPhone: clientPhone,
			Duration:    duration,
			CallLink:    notify.CallRecordLink,
			CallDate:    callDate,
			CallTime:    callDate,
			Status:      domain.StatusPending,
			Source:      "webhook",
		}

		if err := callRepo.Create(context.Background(), call); err != nil {
			log.Println("Database error saving call:", err)
			return
		}

		log.Printf("Enqueuing audio processing job for call %s", callID)

		job := queue.AudioProcessingJob{
			CallID:    callID,
			CompanyID: companyID,
			AudioURL:  notify.CallRecordLink,
			ManagerID: notify.UserID,
		}

		if err := publisher.EnqueueAudioProcessing(context.Background(), job); err != nil {
			log.Println("Queue error enqueuing job:", err)
		}
	} else {
		log.Printf("Ignored notify for call %s (no recording link yet)", notify.CallID)
	}
}
