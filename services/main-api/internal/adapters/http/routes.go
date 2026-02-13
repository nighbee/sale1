package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
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
	userHandler *handlers.UserHandler,
	scriptHandler *handlers.ScriptHandler,
	notificationHandler *handlers.NotificationHandler,
	wsHandler *handlers.WSHandler,
	jwtService ports.JWTService,
) {
	api := app.Group("/api/v1")

	// Public routes
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)

	// Protected routes
	protected := api.Group("", middleware.JWTAuth(jwtService))

	// WebSocket
	protected.Get("/ws", handlers.WSUpgrade, websocket.New(wsHandler.Handle))

	// Notifications
	notifications := protected.Group("/notifications")
	notifications.Get("/", notificationHandler.ListNotifications)
	notifications.Put("/:id/read", notificationHandler.MarkAsRead)

	// Users
	users := protected.Group("/users", middleware.RequireRole("super_admin", "tenant_admin"))
	users.Get("/", userHandler.ListUsers)
	users.Post("/invite", userHandler.InviteUser)
	users.Get("/:id", userHandler.GetUser)
	users.Put("/:id", userHandler.UpdateUser)
	users.Delete("/:id", userHandler.DeleteUser)

	// Calls
	calls := protected.Group("/calls")
	calls.Get("/", callHandler.ListCalls)
	calls.Get("/:id", callHandler.GetCall)
	calls.Get("/:id/transcript", callHandler.GetTranscript)
	calls.Get("/:id/analysis", callHandler.GetAnalysis)
	calls.Get("/:id/audio", callHandler.GetAudio)
	calls.Post("/:id/reprocess", middleware.RequireRole("super_admin", "tenant_admin"), callHandler.ReprocessCall)

	// Scripts
	scripts := protected.Group("/scripts")
	scripts.Post("/", middleware.RequireRole("super_admin", "tenant_admin"), scriptHandler.CreateScript)
	scripts.Get("/", scriptHandler.ListScripts)
	scripts.Get("/:id", scriptHandler.GetScript)
	scripts.Get("/:id/content", scriptHandler.GetScriptContent)
	scripts.Put("/:id", middleware.RequireRole("super_admin", "tenant_admin"), scriptHandler.UpdateScript)
	scripts.Delete("/:id", middleware.RequireRole("super_admin", "tenant_admin"), scriptHandler.DeleteScript)

	// Analytics
	analytics := protected.Group("/analytics")
	analytics.Get("/team-performance", middleware.RequireRole("super_admin", "tenant_admin"), analyticsHandler.GetTeamPerformance)
	analytics.Get("/leaderboard", analyticsHandler.GetLeaderboard)

	// Company
	companies := protected.Group("/companies", middleware.RequireRole("super_admin", "tenant_admin"))
	companies.Get("/:id", companyHandler.GetCompany)
	companies.Put("/:id/settings", companyHandler.UpdateSettings)
}
