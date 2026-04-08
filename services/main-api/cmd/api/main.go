// @title SalesAI API
// @version 1.0
// @description Intelligent Revenue Intelligence & Coaching SaaS API.
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.salesai.local/support
// @contact.email support@salesai.local

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.apiKey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer " followed by your JWT token.

package main

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"

	"github.com/go-redis/redis/v8"
	"github.com/salesai/main-api/internal/adapters/events"
	"github.com/salesai/main-api/internal/adapters/grpc"
	httpAdapter "github.com/salesai/main-api/internal/adapters/http"
	"github.com/salesai/main-api/internal/adapters/http/handlers"
	"github.com/salesai/main-api/internal/adapters/payment"
	"github.com/salesai/main-api/internal/adapters/http/middleware"
	"github.com/salesai/main-api/internal/adapters/http/ws"
	"github.com/salesai/main-api/internal/adapters/queue"
	"github.com/salesai/main-api/internal/adapters/repositories"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
	"github.com/salesai/main-api/internal/core/usecases/auth"
	"github.com/salesai/main-api/internal/core/usecases/billing"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	"github.com/salesai/main-api/internal/core/usecases/integrations"
	"github.com/salesai/main-api/internal/core/usecases/teams"
	"github.com/salesai/main-api/internal/infrastructure/config"
	"github.com/salesai/main-api/internal/infrastructure/database"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"github.com/salesai/main-api/internal/infrastructure/security"
)

func main() {
	applogger.Init("main-api")
	defer applogger.Sync()
	log := applogger.L

	cfg := config.Load()

	var db *sql.DB
	var err error
	maxRetries := 10
	for i := 1; i <= maxRetries; i++ {
		db, err = sql.Open("postgres", cfg.DatabaseURL)
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
		log.Fatal("Failed to connect to database after maximum retries", zap.Error(err))
	}
	defer db.Close()

	// Run automatic migrations
	if err := database.RunMigrations(db, cfg.MigrationsPath); err != nil {
		log.Warn("Database migrations warning", zap.Error(err))
	}

	// Repositories
	userRepo := repositories.NewUserRepository(db)
	companyRepo := repositories.NewCompanyRepository(db)
	callRepo := repositories.NewCallRepository(db)
	transcriptRepo := repositories.NewTranscriptRepository(db)
	analysisRepo := repositories.NewAnalysisRepository(db)
	scriptRepo := repositories.NewScriptRepository(db)
	notificationRepo := repositories.NewNotificationRepository(db)
	teamRepo := repositories.NewTeamRepository(db)
	integrationRepo := repositories.NewIntegrationRepository(db)
	aiSettingsRepo := repositories.NewAISettingsRepository(db)

	log.Info("PostgreSQL connected")

	// Services
	jwtService := security.NewJWTService(cfg.JWTSecret, cfg.JWTExpiry)


	minioClient, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Fatal("Failed to connect to MinIO", zap.Error(err))
	} else {
		log.Info("MinIO connected", zap.String("endpoint", cfg.MinioEndpoint))
	}

	// Initialize public MinIO client if public endpoint is provided
	var publicMinioClient *minio.Client
	if cfg.MinioPublicEndpoint != "" {
		publicEndpoint := cfg.MinioPublicEndpoint
		// Parse host from endpoint if it's a full URL
		if strings.Contains(publicEndpoint, "://") {
			u, err := url.Parse(publicEndpoint)
			if err == nil && u.Host != "" {
				publicEndpoint = u.Host
			}
		}

		publicMinioClient, err = minio.New(publicEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
			Secure: false,
		})
		if err != nil {
			log.Warn("Failed to connect to public MinIO", zap.String("endpoint", publicEndpoint), zap.Error(err))
		} else {
			log.Info("Public MinIO connected", zap.String("endpoint", publicEndpoint))
		}
	}

	grpcClient, err := grpc.NewGRPCClient(cfg.STTServiceGRPC, cfg.AnalyticsGRPC)
	if err != nil {
		log.Warn("Failed to connect to gRPC services", zap.Error(err))
	} else {
		log.Info("gRPC clients connected",
			zap.String("stt", cfg.STTServiceGRPC),
			zap.String("analytics", cfg.AnalyticsGRPC))
	}

	// Redis client
	var opts *redis.Options
	if strings.Contains(cfg.RedisURL, "://") {
		opts, err = redis.ParseURL(cfg.RedisURL)
		if err != nil {
			log.Fatal("Failed to parse Redis URL", zap.Error(err))
		}
	} else {
		opts = &redis.Options{
			Addr: cfg.RedisURL,
		}
	}

	rdb := redis.NewClient(opts)
	log.Info("Redis client initialised", zap.String("addr", opts.Addr))

	// Publishers
	bullmqPublisher := queue.NewBullMQPublisher(rdb)

	// Use Cases
	registerUC := auth.NewRegisterUseCase(userRepo, companyRepo, jwtService)
	loginUC := auth.NewLoginUseCase(userRepo, jwtService)
	refreshUC := auth.NewRefreshUseCase(userRepo, jwtService)
	listCallsUC := calls.NewListCallsUseCase(callRepo)
	reprocessCallUC := calls.NewReprocessCallUseCase(callRepo, bullmqPublisher)
	teamPerformanceUC := analytics.NewTeamPerformanceUseCase(analysisRepo)
	teamUC := teams.NewTeamUseCase(teamRepo, userRepo, scriptRepo)
	integrationUC := integrations.NewIntegrationUseCase(integrationRepo)

	stripeAdapter := payment.NewStripeAdapter(cfg.StripeSecretKey)
	billingUC := billing.NewBillingUseCase(companyRepo, userRepo, stripeAdapter)

	// WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Redis Consumer for Notifications
	redisConsumer := events.NewRedisConsumer(rdb, hub, callRepo, userRepo, integrationRepo)
	go redisConsumer.Start(context.Background())

	// Handlers
	authHandler := handlers.NewAuthHandler(registerUC, loginUC, refreshUC)
	callHandler := handlers.NewCallHandler(listCallsUC, reprocessCallUC, callRepo, transcriptRepo, analysisRepo, minioClient, publicMinioClient, grpcClient, cfg.MinioPresign, time.Duration(cfg.MinioPresignExpirySeconds)*time.Second)
	analyticsHandler := handlers.NewAnalyticsHandler(teamPerformanceUC)
	companyHandler := handlers.NewCompanyHandler(companyRepo, billingUC)
	userHandler := handlers.NewUserHandler(userRepo, listCallsUC)
	teamHandler := handlers.NewTeamHandler(teamUC)
	integrationHandler := handlers.NewIntegrationHandler(integrationUC)
	scriptHandler := handlers.NewScriptHandler(scriptRepo, cfg.ScriptServiceURL)
	notificationHandler := handlers.NewNotificationHandler(notificationRepo)
	aiSettingsHandler := handlers.NewAISettingsHandler(aiSettingsRepo)
	wsHandler := handlers.NewWSHandler(hub)

	app := fiber.New()

	// Structured logging middlewares (replaces fiber's built-in logger)
	app.Use(middleware.CorrelationID())
	app.Use(middleware.RequestLogger())

	prometheus := fiberprometheus.New("main-api")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	httpAdapter.SetupRoutes(app, authHandler, callHandler, analyticsHandler, companyHandler, userHandler, teamHandler, integrationHandler, scriptHandler, notificationHandler, aiSettingsHandler, wsHandler, jwtService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Info("Main API starting", zap.String("port", port))
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("Server exited with error", zap.Error(err))
	}
}
