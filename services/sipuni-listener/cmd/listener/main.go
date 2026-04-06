package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/url"
	"os"
	"os/signal"
	"sync"
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
	connections   = make(map[string]chan struct{}) // companyID -> stop channel
	mu            sync.Mutex
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

	apiClient := api.NewMainAPIClient()

	go func() {
		for {
			log.Info("Checking for active Sipuni integrations")
			integrations, err := apiClient.GetActiveIntegrations()
			if err != nil {
				log.Error("Failed to fetch integrations", zap.Error(err))
			} else {
				activeCompanyIDs := make(map[string]bool)
				for _, i := range integrations {
					if i.IntegrationType == "sipuni" {
						var creds struct {
							APIKey string `json:"api_key"`
						}
						if err := json.Unmarshal(i.Credentials, &creds); err == nil && creds.APIKey != "" {
							activeCompanyIDs[i.CompanyID] = true
							mu.Lock()
							if _, exists := connections[i.CompanyID]; !exists {
								stopChan := make(chan struct{})
								connections[i.CompanyID] = stopChan
								go manageSipuniConnection(i.CompanyID, creds.APIKey, stopChan)
								log.Info("Started Sipuni connection for company", zap.String("company_id", i.CompanyID))
							}
							mu.Unlock()
						}
					}
				}

				// Stop connections for integrations that are no longer active
				mu.Lock()
				for companyID, stopChan := range connections {
					if !activeCompanyIDs[companyID] {
						close(stopChan)
						delete(connections, companyID)
						log.Info("Stopped Sipuni connection for company", zap.String("company_id", companyID))
					}
				}
				mu.Unlock()
			}
			time.Sleep(1 * time.Minute)
		}
	}()

	<-interrupt
	log.Info("Interrupt received, shutting down")
}

func manageSipuniConnection(companyID string, apiKey string, stopChan chan struct{}) {
	log := applogger.L.With(zap.String("company_id", companyID))
	u := url.URL{Scheme: "wss", Host: "wss.sipuni.com", Path: "/api"}

	backoff := 2 * time.Second
	maxBackoff := 60 * time.Second
	retryCount := 0

	for {
		select {
		case <-stopChan:
			return
		default:
			log.Info("Connecting to Sipuni WebSocket", zap.String("url", u.String()), zap.Int("retry_count", retryCount))
			c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
			if err != nil {
				log.Warn("WebSocket dial error, will retry",
					zap.Error(err), zap.Duration("backoff", backoff), zap.Int("retry_count", retryCount))
				retryCount++
				select {
				case <-stopChan:
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

			// Listen loop and keepalive
			done := make(chan struct{})
			keepaliveStop := make(chan struct{})

			go func() {
				ticker := time.NewTicker(30 * time.Second)
				defer ticker.Stop()
				for {
					select {
					case <-ticker.C:
						if err := c.WriteJSON(map[string]string{"type": "keepalive"}); err != nil {
							return
						}
					case <-keepaliveStop:
						return
					}
				}
			}()

			go func() {
				defer close(done)
				defer close(keepaliveStop)
				for {
					_, message, err := c.ReadMessage()
					if err != nil {
						return
					}

					var event SipuniEvent
					if err := json.Unmarshal(message, &event); err == nil {
						if event.Action == "notify" {
							handleEventUC.Execute(context.Background(), companyID, event.Request)
						} else if event.Action == "auth" && event.Status != 1 {
							log.Error("Sipuni authentication failed", zap.Int("status", event.Status))
							return
						}
					} else {
						// Try unwrapped
						var directNotify usecases.SipuniNotifyRequest
						if err := json.Unmarshal(message, &directNotify); err == nil && directNotify.CallID != "" {
							rawRequest, _ := json.Marshal(directNotify)
							handleEventUC.Execute(context.Background(), companyID, rawRequest)
						}
					}
				}
			}()

			select {
			case <-done:
				c.Close()
				log.Warn("Connection closed, reconnecting")
			case <-stopChan:
				c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				c.Close()
				return
			}
		}
	}
}

