package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/swagger"
	"github.com/gofiber/websocket/v2"
	_ "github.com/salesai/main-api/docs"
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
	teamHandler *handlers.TeamHandler,
	integrationHandler *handlers.IntegrationHandler,
	scriptHandler *handlers.ScriptHandler,
	notificationHandler *handlers.NotificationHandler,
	wsHandler *handlers.WSHandler,
	jwtService ports.JWTService,
) {
	api := app.Group("/api/v1")

	// Swagger documentation
	app.Get("/swagger/*", swagger.HandlerDefault)

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

	// Allow audio streaming for tenant admins and super admins
	protected.Get("/calls/:id/audio", middleware.RequireRole("super_admin", "tenant_admin"), callHandler.GetAudio)

	// Notifications
	notifications := protected.Group("/notifications")
	notifications.Get("/", notificationHandler.ListNotifications)
	notifications.Put("/:id/read", notificationHandler.MarkAsRead)

	// Users
	users := protected.Group("/users", middleware.RequireRole("super_admin", "tenant_admin"))
	users.Get("/", userHandler.ListUsers)
	protected.Get("/user/me", userHandler.GetMe)
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
	protected.Get("/users/:id/calls", userHandler.GetUserCalls)
	calls.Post("/:id/reprocess", callHandler.ReprocessCall)

	// Scripts
	scripts := protected.Group("/scripts")
	scripts.Post("/", middleware.RequireRole("super_admin", "tenant_admin"), scriptHandler.CreateScript)
	scripts.Get("/", scriptHandler.ListScripts)
	scripts.Get("/:id", scriptHandler.GetScript)
	scripts.Get("/:id/content", scriptHandler.GetScriptContent)
	scripts.Get("/:id/download", scriptHandler.DownloadScript)
	scripts.Put("/:id", middleware.RequireRole("super_admin", "tenant_admin"), scriptHandler.UpdateScript)
	scripts.Delete("/:id", middleware.RequireRole("super_admin", "tenant_admin"), scriptHandler.DeleteScript)

	// Base Scripts
	baseScripts := protected.Group("/base-scripts")
	baseScripts.Get("/current", scriptHandler.GetBaseScript)
	baseScripts.Get("/", scriptHandler.ListBaseScripts)
	baseScripts.Post("/:id/activate", middleware.RequireRole("super_admin"), scriptHandler.ActivateAsBase)
	baseScripts.Get("/:id/metrics", scriptHandler.GetBaseMetrics)

	// Analytics
	analytics := protected.Group("/analytics")
	analytics.Get("/team-performance", analyticsHandler.GetTeamPerformance)
	analytics.Get("/leaderboard", analyticsHandler.GetLeaderboard)
	analytics.Get("/leaderboard/export/:format", analyticsHandler.ExportLeaderboard)

	// Settings & Billing
	settings := protected.Group("/settings", middleware.RequireRole("super_admin", "tenant_admin"))
	settings.Get("/billing", companyHandler.GetBilling)
	settings.Put("/billing", companyHandler.UpdateBilling)

	// Teams
	protected.Post("/teams/ensure", teamHandler.Ensure)

	teams := protected.Group("/teams", middleware.RequireRole("super_admin", "tenant_admin"))
	teams.Post("/", teamHandler.Create)
	teams.Get("/", teamHandler.List)
	teams.Get("/:id", teamHandler.Get)
	teams.Put("/:id", teamHandler.Update)
	teams.Delete("/:id", teamHandler.Delete)
	teams.Post("/:id/members", teamHandler.AddMember)
	teams.Delete("/:id/members/:userID", teamHandler.RemoveMember)

	// Integrations
	integrations := protected.Group("/integrations", middleware.RequireRole("super_admin", "tenant_admin"))
	integrations.Post("/", integrationHandler.Save)
	integrations.Get("/", integrationHandler.List)
	integrations.Post("/google-sheets/sync", integrationHandler.TriggerSheetSync)
	integrations.Get("/:type", integrationHandler.Get)
	integrations.Delete("/:type", integrationHandler.Delete)

	// Internal
	internal := api.Group("/internal")
	internal.Get("/integrations", integrationHandler.ListInternal)
}
