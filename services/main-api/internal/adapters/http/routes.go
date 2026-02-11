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
	userHandler *handlers.UserHandler,
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
	auth.Post("/refresh", authHandler.RefreshToken)
	auth.Post("/forgot-password", authHandler.ForgotPassword)
	auth.Post("/reset-password", authHandler.ResetPassword)

	// Protected routes
	protected := api.Group("", middleware.JWTAuth(jwtService))

	authProtected := protected.Group("/auth")
	authProtected.Post("/logout", authHandler.Logout)

	// Users
	users := protected.Group("/users")
	users.Get("/", middleware.RequireRole("tenant_admin", "super_admin"), userHandler.ListUsers)
	users.Post("/invite", middleware.RequireRole("tenant_admin", "super_admin"), userHandler.InviteUser)
	users.Get("/:id", userHandler.GetUser)
	users.Put("/:id", middleware.RequireRole("tenant_admin", "super_admin"), userHandler.UpdateUser)
	users.Delete("/:id", middleware.RequireRole("tenant_admin", "super_admin"), userHandler.DeleteUser)

	// Calls
	calls := protected.Group("/calls")
	calls.Get("/", callHandler.ListCalls)
	calls.Get("/:id", callHandler.GetCall)
	calls.Get("/:id/transcript", callHandler.GetTranscript)
	calls.Get("/:id/analysis", callHandler.GetAnalysis)
	calls.Get("/:id/audio", callHandler.GetAudio)
	calls.Post("/:id/reprocess", middleware.RequireRole("tenant_admin", "super_admin"), callHandler.ReprocessCall)

	// Analytics
	analytics := protected.Group("/analytics")
	analytics.Get("/team-performance", middleware.RequireRole("tenant_admin", "super_admin"), analyticsHandler.GetTeamPerformance)
	analytics.Get("/leaderboard", middleware.RequireRole("tenant_admin", "super_admin"), analyticsHandler.GetLeaderboard)
	analytics.Get("/trends", middleware.RequireRole("tenant_admin", "super_admin"), analyticsHandler.GetTrends)

	// Company
	companies := protected.Group("/companies")
	companies.Get("/:id", middleware.RequireRole("tenant_admin", "super_admin"), companyHandler.GetCompany)
	companies.Put("/:id/settings", middleware.RequireRole("tenant_admin", "super_admin"), companyHandler.UpdateSettings)
}
