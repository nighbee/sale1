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
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"github.com/salesai/sipuni-listener/internal/adapters/queue"
	"github.com/salesai/sipuni-listener/internal/adapters/repositories"
	"github.com/salesai/sipuni-listener/internal/core/usecases"
	"github.com/salesai/sipuni-listener/internal/infrastructure/api"
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

var (
	handleEventUC *usecases.HandleEventUseCase
)

func main() {
	applogger.Init("sipuni-listener")
	defer applogger.Sync()
	log := applogger.L

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		password := os.Getenv("REDIS_PASSWORD")
		host := os.Getenv("REDIS_HOST")
		if host == "" {
			host = "redis"
		}
		port := os.Getenv("REDIS_PORT")
		if port == "" {
			port = "6379"
		}
		if password != "" {
			redisURL = "redis://:" + password + "@" + host + ":" + port
		} else {
			redisURL = "redis://" + host + ":" + port
		}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	var db *sql.DB
	var err error
	maxRetries := 10
	for i := 1; i <= maxRetries; i++ {
		db, err = sql.Open("postgres", dbURL)
		if err == nil {
			err = db.Ping()
			if err == nil {
				break
			}
		}
		log.Warn("Failed to connect to database, retrying...", zap.Int("attempt", i), zap.Error(err))
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatal("database connection failed after maximum retries", zap.Error(err))
	}
	defer db.Close()
	log.Info("PostgreSQL connected")

	callRepo := repositories.NewCallRepository(db)
	userRepo := repositories.NewUserRepository(db)

	publisher, err := queue.NewBullMQPublisher(redisURL)
	if err != nil {
		log.Fatal("redis publisher init failed", zap.Error(err))
	}
	log.Info("BullMQ publisher ready", zap.String("redis_url", redisURL))

	handleEventUC = usecases.NewHandleEventUseCase(callRepo, userRepo, publisher)

	// Start a simple HTTP server for metrics
	go func() {
		app := fiber.New()
		prometheus := fiberprometheus.New("sipuni-listener")
		prometheus.RegisterAt(app, "/metrics")
		app.Use(prometheus.Middleware)

		app.Get("/health", func(c *fiber.Ctx) error {
			return c.Status(200).SendString("OK")
		})

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
	apiClient := api.NewMainAPIClient()

	backoff := 2 * time.Second
	maxBackoff := 60 * time.Second
	retryCount := 0

	for {
		apiKey := os.Getenv("SIPUNI_API_KEY")
		integrations, err := apiClient.GetActiveIntegrations()
		if err == nil {
			for _, i := range integrations {
				if i.IntegrationType == "sipuni" {
					var creds struct {
						APIKey string `json:"api_key"`
					}
					if err := json.Unmarshal(i.Credentials, &creds); err == nil && creds.APIKey != "" {
						apiKey = creds.APIKey
						log.Info("Using Sipuni API key from main-api")
					}
					break
				}
			}
		} else {
			log.Warn("Failed to fetch integrations from main-api, using env fallback", zap.Error(err))
		}

		if apiKey == "" {
			log.Warn("Sipuni API Key not found, retrying in backoff...")
			time.Sleep(backoff)
			continue
		}

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
						handleEventUC.Execute(context.Background(), event.Request)
						continue
					}
				}

				// Fallback: Try to parse as direct notify request (unwrapped)
				var directNotify usecases.SipuniNotifyRequest
				err = json.Unmarshal(message, &directNotify)
				if err == nil && directNotify.CallID != "" {
					log.Info("received direct notify (unwrapped)",
						zap.String("call_id", directNotify.CallID))
					// We need to re-marshal to RawMessage to use existing handleNotify
					rawRequest, _ := json.Marshal(directNotify)
					handleEventUC.Execute(context.Background(), rawRequest)
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

