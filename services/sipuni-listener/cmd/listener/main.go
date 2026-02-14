package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/url"
	"os"
	"os/signal"
	"strconv"
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
	log.Println("sending auth message")
	log.Printf("auth message: %+v", authMsg)
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

	// We only care about calls with a record link
	if notify.CallRecordLink != "" {
		log.Printf("Received notify for call %s with status %s", notify.CallID, notify.Status)

		callID := uuid.New().String()

		// Parse timestamps for duration
		startTime, _ := strconv.ParseInt(notify.CallStartTimestamp, 10, 64)
		endTime, _ := strconv.ParseInt(notify.Timestamp, 10, 64)
		duration := int(endTime - startTime)
		if duration <= 0 {
			duration = 1
		}

		callDate := time.Unix(startTime, 0)

		call := &domain.Call{
			ID:          callID,
			CompanyID:   companyID,
			ManagerID:   notify.UserID,
			ManagerName: "Sipuni Manager",
			ClientPhone: notify.DstNum, // In outgoing, Dst is client. In incoming, Src is client.
			Duration:    duration,
			CallLink:    notify.CallRecordLink,
			CallDate:    callDate,
			CallTime:    callDate,
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
			AudioURL:  notify.CallRecordLink,
			ManagerID: notify.UserID,
		}

		err := publisher.EnqueueAudioProcessing(context.Background(), job)
		if err != nil {
			log.Println("enqueue job:", err)
		}
	}
}
