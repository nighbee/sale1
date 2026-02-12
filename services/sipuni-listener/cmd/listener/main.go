package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/url"
	"os"
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
	CallID    string `json:"call_id"`
	Direction string `json:"direction"`
	From      string `json:"from"`
	To        string `json:"to"`
	RecordURL string `json:"record_url"`
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
		// Fallback to test company for development
		companyID = "550e8400-e29b-41d4-a716-446655440000"
	}

	publisher, err = queue.NewBullMQPublisher(redisURL)
	if err != nil {
		log.Fatal("redis publisher:", err)
	}

	u := url.URL{Scheme: "wss", Host: "wss.sipuni.com", Path: "/api"}
	log.Printf("connecting to %s", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	// Auth
	apiKey := os.Getenv("SIPUNI_API_KEY")
	authMsg := SipuniAuthMessage{
		Type: "auth",
		Body: SipuniAuthBody{Key: apiKey},
	}
	err = c.WriteJSON(authMsg)
	if err != nil {
		log.Println("auth:", err)
		return
	}

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}

			var event SipuniEvent
			if err := json.Unmarshal(message, &event); err == nil {
				if event.Action == "notify" && event.Namespace == "api" {
					handleNotify(event.Request)
				}
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case <-interrupt:
			log.Println("interrupt")
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("write close:", err)
				return
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return
		}
	}
}

func handleNotify(request json.RawMessage) {
	var notify SipuniNotifyRequest
	if err := json.Unmarshal(request, &notify); err != nil {
		log.Println("unmarshal notify:", err)
		return
	}

	// We only care about completed calls with a record URL
	if notify.RecordURL != "" {
		log.Printf("Received notify for call %s", notify.CallID)

		callID := uuid.New().String()
		now := time.Now()

		call := &domain.Call{
			ID:          callID,
			CompanyID:   companyID,
			ManagerID:   notify.To, // Assuming 'to' is the manager for inbound
			ManagerName: "Sipuni Manager",
			ClientPhone: notify.From,
			Duration:    60, // Mock duration if not provided
			CallLink:    notify.RecordURL,
			CallDate:    now,
			CallTime:    now,
			Status:      domain.StatusPending,
			Source:      "webhook",
		}

		if err := callRepo.Create(context.Background(), call); err != nil {
			log.Println("save call:", err)
			return
		}

		log.Printf("Enqueuing job for call %s", callID)

		job := queue.AudioProcessingJob{
			CallID:    callID,
			CompanyID: companyID,
			AudioURL:  notify.RecordURL,
			ManagerID: notify.To,
		}

		err := publisher.EnqueueAudioProcessing(context.Background(), job)
		if err != nil {
			log.Println("enqueue job:", err)
		}
	}
}
