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
	aiSettingsHandler *handlers.AISettingsHandler,
	queueHandler *handlers.QueueHandler,
	systemHandler *handlers.SystemHandler,
	wsHandler *handlers.WSHandler,
	jwtService ports.JWTService,
) {
	api := app.Group("/api/v1")

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(200).SendString("OK")
	})

	// Swagger documentation
	app.Get("/swagger/*", swagger.HandlerDefault)

	// Public routes
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)

	// Internal
	internal := api.Group("/internal", middleware.InternalAuth())
	internal.Get("/integrations", integrationHandler.ListInternal)
	internal.Get("/ai-settings", aiSettingsHandler.GetInternal)

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
	settings.Get("/", companyHandler.GetCompany)
	settings.Put("/", companyHandler.UpdateSettings)
	settings.Get("/billing", companyHandler.GetBilling)
	settings.Put("/billing", companyHandler.UpdateBilling)
	settings.Post("/billing/setup-intent", companyHandler.CreateSetupIntent)

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
	integrations.Get("/:type", integrationHandler.Get)
	integrations.Post("/:type/test", integrationHandler.TestConnection)
	integrations.Post("/:type/check", integrationHandler.CheckModel)
	integrations.Post("/:type/models", integrationHandler.GetModels)
	integrations.Delete("/:type", integrationHandler.Delete)

	// AI Settings
	aiSettings := protected.Group("/ai-settings", middleware.RequireRole("super_admin", "tenant_admin"))
	aiSettings.Get("/", aiSettingsHandler.Get)
	aiSettings.Put("/", aiSettingsHandler.Update)

	// Queue management (tenant admin only)
	queue := protected.Group("/calls/queue", middleware.RequireRole("super_admin", "tenant_admin"))
	queue.Get("/status", queueHandler.GetStatus)
	queue.Post("/bulk-reprocess", queueHandler.BulkReprocess)
	queue.Delete("/", queueHandler.ClearQueue)
	queue.Post("/stop", queueHandler.StopQueue)
	queue.Post("/resume", queueHandler.ResumeQueue)
	queue.Get("/items", queueHandler.ListItems)
	queue.Post("/items", queueHandler.CreateItem)
	queue.Put("/items", queueHandler.UpdateItem)
	queue.Delete("/items", queueHandler.DeleteItem)
	admin := api.Group("/admin", middleware.JWTAuth(jwtService), middleware.RequireRole("super_admin"))

	// Companies Admin
	admin.Get("/companies", companyHandler.ListAllCompanies)
	admin.Get("/companies/:id", companyHandler.GetCompanyDetails)
	admin.Put("/companies/:id", companyHandler.UpdateCompanyGlobal)

	// Users Admin
	admin.Get("/users", userHandler.ListAllUsers)
	admin.Put("/users/:id", userHandler.UpdateUserGlobal)
	admin.Delete("/users/:id", userHandler.DeleteUserGlobal)

	// Calls Admin
	admin.Get("/calls", callHandler.ListAllCalls)

	// Teams Admin
	admin.Get("/teams", teamHandler.ListAllTeams)

	// Scripts Admin
	admin.Get("/scripts", scriptHandler.ListAllScripts)

	// System Admin
	admin.Get("/system/status", systemHandler.GetStatus)
	admin.Get("/system/metrics", systemHandler.GetMetrics)
	admin.Get("/system/logs", systemHandler.GetLogs)
	admin.Get("/system/redis", systemHandler.ListRedisKeys)
	admin.Get("/system/redis/value", systemHandler.GetRedisValue)
	admin.Put("/system/redis", systemHandler.UpdateRedisValue)
	admin.Delete("/system/redis", systemHandler.DeleteRedisKey)
	admin.Post("/system/queues/clear", systemHandler.ClearQueue)
	admin.Delete("/system/queues/item", systemHandler.RemoveQueueItem)
}
