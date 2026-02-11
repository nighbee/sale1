package main

import (
	"context"
	"encoding/json"
	"log"
	"net/url"
	"os"
	"os/signal"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/salesai/sipuni-listener/internal/adapters/queue"
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

var publisher *queue.BullMQPublisher

func main() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://redis:6379"
	}

	var err error
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
		log.Printf("Enqueuing job for call %s", notify.CallID)

		job := queue.AudioProcessingJob{
			CallID:    uuid.New().String(),
			CompanyID: "550e8400-e29b-41d4-a716-446655440000", // Default test company
			AudioURL:  notify.RecordURL,
			ManagerID: notify.To,
		}

		err := publisher.EnqueueAudioProcessing(context.Background(), job)
		if err != nil {
			log.Println("enqueue job:", err)
		}
	}
}
