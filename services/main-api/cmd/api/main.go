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
	"github.com/salesai/main-api/internal/adapters/http/middleware"
	"github.com/salesai/main-api/internal/adapters/http/ws"
	"github.com/salesai/main-api/internal/adapters/repositories"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
	"github.com/salesai/main-api/internal/core/usecases/auth"
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

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database", zap.Error(err))
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

	log.Info("PostgreSQL connected")

	// Services
	jwtService := security.NewJWTService(cfg.JWTSecret, cfg.JWTExpiry)

	minioClient, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Warn("Failed to connect to MinIO", zap.Error(err))
	} else {
		log.Info("MinIO connected", zap.String("endpoint", cfg.MinioEndpoint))
	}

	grpcClient, err := grpc.NewGRPCClient(cfg.STTServiceGRPC, cfg.AnalyticsGRPC)
	if err != nil {
		log.Warn("Failed to connect to gRPC services", zap.Error(err))
	} else {
		log.Info("gRPC clients connected",
			zap.String("stt", cfg.STTServiceGRPC),
			zap.String("analytics", cfg.AnalyticsGRPC))
	}

	// Use Cases
	registerUC := auth.NewRegisterUseCase(userRepo, companyRepo, jwtService, cfg.DefaultCompanyID)
	loginUC := auth.NewLoginUseCase(userRepo, jwtService)
	refreshUC := auth.NewRefreshUseCase(userRepo, jwtService)
	listCallsUC := calls.NewListCallsUseCase(callRepo)
	teamPerformanceUC := analytics.NewTeamPerformanceUseCase(analysisRepo)
	teamUC := teams.NewTeamUseCase(teamRepo, userRepo, scriptRepo)
	integrationUC := integrations.NewIntegrationUseCase(integrationRepo)

	// Redis client
	redisAddr := strings.TrimSpace(cfg.RedisURL)
	if strings.Contains(redisAddr, "://") {
		u, err := url.Parse(redisAddr)
		if err == nil && u.Host != "" {
			redisAddr = u.Host
		} else {
			redisAddr = strings.TrimPrefix(redisAddr, "redis://")
			redisAddr = strings.TrimPrefix(redisAddr, "rediss://")
		}
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	log.Info("Redis client initialised", zap.String("addr", redisAddr))

	// WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Redis Consumer for Notifications
	redisConsumer := events.NewRedisConsumer(rdb, hub, callRepo, integrationRepo)
	go redisConsumer.Start(context.Background())

	// Handlers
	authHandler := handlers.NewAuthHandler(registerUC, loginUC, refreshUC)
	callHandler := handlers.NewCallHandler(listCallsUC, callRepo, transcriptRepo, analysisRepo, minioClient, grpcClient)
	analyticsHandler := handlers.NewAnalyticsHandler(teamPerformanceUC)
	companyHandler := handlers.NewCompanyHandler(companyRepo)
	userHandler := handlers.NewUserHandler(userRepo)
	teamHandler := handlers.NewTeamHandler(teamUC)
	integrationHandler := handlers.NewIntegrationHandler(integrationUC)
	scriptHandler := handlers.NewScriptHandler(scriptRepo, cfg.ScriptServiceURL)
	notificationHandler := handlers.NewNotificationHandler(notificationRepo)
	wsHandler := handlers.NewWSHandler(hub)

	app := fiber.New()

	// Structured logging middlewares (replaces fiber's built-in logger)
	app.Use(middleware.CorrelationID())
	app.Use(middleware.RequestLogger())

	prometheus := fiberprometheus.New("main-api")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	httpAdapter.SetupRoutes(app, authHandler, callHandler, analyticsHandler, companyHandler, userHandler, teamHandler, integrationHandler, scriptHandler, notificationHandler, wsHandler, jwtService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Info("Main API starting", zap.String("port", port))
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("Server exited with error", zap.Error(err))
	}
}
