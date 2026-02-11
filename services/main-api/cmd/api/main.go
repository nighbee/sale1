package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	_ "github.com/lib/pq"

	"github.com/salesai/main-api/internal/adapters/http"
	"github.com/salesai/main-api/internal/adapters/http/handlers"
	"github.com/salesai/main-api/internal/adapters/repositories"
	"github.com/salesai/main-api/internal/core/usecases/auth"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	"github.com/salesai/main-api/internal/core/usecases/users"
	"github.com/salesai/main-api/internal/infrastructure/config"
	"github.com/salesai/main-api/internal/infrastructure/security"
)

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

	// Services
	jwtService := security.NewJWTService(cfg.JWTSecret, cfg.JWTExpiry)

	// Use Cases
	registerUC := auth.NewRegisterUseCase(userRepo, companyRepo, jwtService)
	loginUC := auth.NewLoginUseCase(userRepo, jwtService)
	refreshTokenUC := auth.NewRefreshTokenUseCase(userRepo, jwtService)
	listCallsUC := calls.NewListCallsUseCase(callRepo)
	getCallDetailsUC := calls.NewGetCallDetailsUseCase(callRepo, transcriptRepo, analysisRepo)
	listUsersUC := users.NewListUsersUseCase(userRepo)
	inviteUserUC := users.NewInviteUserUseCase(userRepo)
	updateUserUC := users.NewUpdateUserUseCase(userRepo)

	// Handlers
	authHandler := handlers.NewAuthHandler(registerUC, loginUC, refreshTokenUC)
	userHandler := handlers.NewUserHandler(listUsersUC, inviteUserUC, updateUserUC, userRepo)
	callHandler := handlers.NewCallHandler(listCallsUC, getCallDetailsUC, callRepo)
	analyticsHandler := handlers.NewAnalyticsHandler(analysisRepo)
	companyHandler := handlers.NewCompanyHandler(companyRepo)

	app := fiber.New()
	app.Use(logger.New())

	http.SetupRoutes(app, authHandler, userHandler, callHandler, analyticsHandler, companyHandler, jwtService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Main API starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
