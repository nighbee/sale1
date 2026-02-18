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
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/go-redis/redis/v8"
	"github.com/salesai/main-api/internal/adapters/events"
	"github.com/salesai/main-api/internal/adapters/grpc"
	"github.com/salesai/main-api/internal/adapters/http"
	"github.com/salesai/main-api/internal/adapters/http/handlers"
	"github.com/salesai/main-api/internal/adapters/http/ws"
	"github.com/salesai/main-api/internal/adapters/repositories"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
	"github.com/salesai/main-api/internal/core/usecases/auth"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	"github.com/salesai/main-api/internal/core/usecases/integrations"
	"github.com/salesai/main-api/internal/core/usecases/teams"
	"github.com/salesai/main-api/internal/infrastructure/config"
	"github.com/salesai/main-api/internal/infrastructure/database"
	"github.com/salesai/main-api/internal/infrastructure/security"
)

func main() {
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Run automatic migrations
	if err := database.RunMigrations(db, cfg.MigrationsPath); err != nil {
		log.Printf("Warning: Database migrations failed: %v", err)
		// We continue anyway, as the DB might be schema-correct but the tool might have issues
		// However, for a fresh start, this is where it would stop.
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

	// Services
	jwtService := security.NewJWTService(cfg.JWTSecret, cfg.JWTExpiry)

	minioClient, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Printf("Warning: Failed to connect to MinIO: %v", err)
	}

	grpcClient, err := grpc.NewGRPCClient(cfg.STTServiceGRPC, cfg.AnalyticsGRPC)
	if err != nil {
		log.Printf("Warning: Failed to connect to gRPC services: %v", err)
	}

	// Use Cases
	registerUC := auth.NewRegisterUseCase(userRepo, companyRepo, jwtService)
	loginUC := auth.NewLoginUseCase(userRepo, jwtService)
	refreshUC := auth.NewRefreshUseCase(userRepo, jwtService)
	listCallsUC := calls.NewListCallsUseCase(callRepo)
	teamPerformanceUC := analytics.NewTeamPerformanceUseCase(analysisRepo)
	teamUC := teams.NewTeamUseCase(teamRepo)
	integrationUC := integrations.NewIntegrationUseCase(integrationRepo)

	// Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisURL,
	})

	// WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Redis Consumer for Notifications
	redisConsumer := events.NewRedisConsumer(rdb, hub, callRepo)
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
	app.Use(logger.New())

	http.SetupRoutes(app, authHandler, callHandler, analyticsHandler, companyHandler, userHandler, teamHandler, integrationHandler, scriptHandler, notificationHandler, wsHandler, jwtService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Main API starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
