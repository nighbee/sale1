package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/adapters/http/handlers"
	"github.com/salesai/main-api/internal/adapters/http/middleware"
	"github.com/salesai/main-api/internal/core/ports"
)

func SetupRoutes(
	app *fiber.App,
	authHandler *handlers.AuthHandler,
	callHandler *handlers.CallHandler,
	analyticsHandler *handlers.AnalyticsHandler,
	companyHandler *handlers.CompanyHandler,
	jwtService ports.JWTService,
) {
	api := app.Group("/api/v1")

	// Public routes
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)

	// Protected routes
	protected := api.Group("", middleware.JWTAuth(jwtService))

	// Calls
	calls := protected.Group("/calls")
	calls.Get("/", callHandler.ListCalls)
	calls.Get("/:id", callHandler.GetCall)

	// Analytics
	analytics := protected.Group("/analytics")
	analytics.Get("/team-performance", analyticsHandler.GetTeamPerformance)
	analytics.Get("/leaderboard", analyticsHandler.GetLeaderboard)

	// Company
	companies := protected.Group("/companies")
	companies.Put("/:id/settings", companyHandler.UpdateSettings)
}
