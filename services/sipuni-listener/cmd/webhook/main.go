package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/salesai/webhook-service/internal/adapters/http/handlers"
)

func main() {
	app := fiber.New()
	app.Use(logger.New())

	webhookHandler := handlers.NewAmoCRMWebhookHandler()

	api := app.Group("/api/v1")
	webhooks := api.Group("/webhooks")
	webhooks.Post("/amocrm/call-finished", webhookHandler.HandleCallFinished)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Webhook Service starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
