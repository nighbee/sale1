package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/salesai/main-api/internal/adapters/grpc"
	"github.com/salesai/main-api/internal/adapters/http"
	"github.com/salesai/main-api/internal/adapters/http/handlers"
	"github.com/salesai/main-api/internal/adapters/repositories"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
	"github.com/salesai/main-api/internal/core/usecases/auth"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	"github.com/salesai/main-api/internal/infrastructure/config"
	"github.com/salesai/main-api/internal/infrastructure/security"
)

// @title SalesAI API
// @version 1.0
// @description Central API for SalesAI Intelligent Revenue Intelligence & Coaching SaaS

// @contact.name API Support
// @contact.email support@salesai.com

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Repositories
	userRepo := repositories.NewUserRepository(db)
	companyRepo := repositories.NewCompanyRepository(db)
	callRepo := repositories.NewCallRepository(db)
	transcriptRepo := repositories.NewTranscriptRepository(db)
	analysisRepo := repositories.NewAnalysisRepository(db)
	scriptRepo := repositories.NewScriptRepository(db)
	notificationRepo := repositories.NewNotificationRepository(db)

	// Services
	jwtService := security.NewJWTService(cfg.JWTSecret, cfg.JWTExpiry)

	minioClient, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Printf("Warning: Failed to connect to MinIO: %v", err)
	}

	sttClient, err := grpc.NewSTTClient(os.Getenv("STT_GRPC_ADDR"))
	if err != nil {
		log.Printf("Warning: Failed to connect to STT gRPC: %v", err)
	}

	analyticsClient, err := grpc.NewAnalyticsClient(os.Getenv("ANALYTICS_GRPC_ADDR"))
	if err != nil {
		log.Printf("Warning: Failed to connect to Analytics gRPC: %v", err)
	}

	// Use Cases
	registerUC := auth.NewRegisterUseCase(userRepo, companyRepo, jwtService)
	loginUC := auth.NewLoginUseCase(userRepo, jwtService)
	refreshUC := auth.NewRefreshUseCase(userRepo, jwtService)
	listCallsUC := calls.NewListCallsUseCase(callRepo)
	teamPerformanceUC := analytics.NewTeamPerformanceUseCase(analysisRepo)

	// Handlers
	authHandler := handlers.NewAuthHandler(registerUC, loginUC, refreshUC)
	callHandler := handlers.NewCallHandler(listCallsUC, callRepo, transcriptRepo, analysisRepo, minioClient, sttClient, analyticsClient)
	analyticsHandler := handlers.NewAnalyticsHandler(teamPerformanceUC)
	companyHandler := handlers.NewCompanyHandler(companyRepo)
	userHandler := handlers.NewUserHandler(userRepo)
	scriptHandler := handlers.NewScriptHandler(scriptRepo, cfg.ScriptServiceURL)
	notificationHandler := handlers.NewNotificationHandler(notificationRepo)

	app := fiber.New()
	app.Use(logger.New())

	http.SetupRoutes(app, authHandler, callHandler, analyticsHandler, companyHandler, userHandler, scriptHandler, notificationHandler, jwtService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Main API starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
