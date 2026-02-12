package http

import (
	"github.com/gofiber/fiber/v2"
	_ "github.com/salesai/main-api/docs"
	"github.com/salesai/main-api/internal/adapters/http/handlers"
	"github.com/salesai/main-api/internal/adapters/http/middleware"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/gofiber/swagger"
)

func SetupRoutes(
	app *fiber.App,
	authHandler *handlers.AuthHandler,
	callHandler *handlers.CallHandler,
	analyticsHandler *handlers.AnalyticsHandler,
	companyHandler *handlers.CompanyHandler,
	userHandler *handlers.UserHandler,
	scriptHandler *handlers.ScriptHandler,
	jwtService ports.JWTService,
) {
	api := app.Group("/api/v1")

	// Swagger
	api.Get("/docs/*", swagger.HandlerDefault)

	// Public routes
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)

	// Protected routes
	protected := api.Group("", middleware.JWTAuth(jwtService))

	// Users
	users := protected.Group("/users")
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
	calls.Post("/:id/reprocess", callHandler.ReprocessCall)

	// Scripts
	scripts := protected.Group("/scripts")
	scripts.Post("/", scriptHandler.CreateScript)
	scripts.Get("/", scriptHandler.ListScripts)
	scripts.Get("/:id", scriptHandler.GetScript)
	scripts.Get("/:id/content", scriptHandler.GetScriptContent)
	scripts.Put("/:id", scriptHandler.UpdateScript)
	scripts.Delete("/:id", scriptHandler.DeleteScript)

	// Analytics
	analytics := protected.Group("/analytics")
	analytics.Get("/team-performance", analyticsHandler.GetTeamPerformance)
	analytics.Get("/leaderboard", analyticsHandler.GetLeaderboard)

	// Company
	companies := protected.Group("/companies")
	companies.Get("/:id", companyHandler.GetCompany)
	companies.Put("/:id/settings", companyHandler.UpdateSettings)
}
