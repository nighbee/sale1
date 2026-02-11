package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AmoCRMWebhookHandler struct {
	// TODO: add use case
}

func NewAmoCRMWebhookHandler() *AmoCRMWebhookHandler {
	return &AmoCRMWebhookHandler{}
}

type AmoCRMPayload struct {
	EventType   string `json:"event_type"`
	ManagerID   string `json:"manager_id"`
	ManagerName string `json:"manager_name"`
	ClientPhone string `json:"client_phone"`
	ClientID    string `json:"client_id"`
	Duration    int    `json:"duration"`
	CallLink    string `json:"call_link"`
	ChatLink    string `json:"chat_link"`
	Timestamp   string `json:"timestamp"`
}

func (h *AmoCRMWebhookHandler) HandleCallFinished(c *fiber.Ctx) error {
	var payload AmoCRMPayload

	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid payload",
		})
	}

	callID := uuid.New().String()

	// TODO: Save to DB and publish to Redis

	return c.JSON(fiber.Map{
		"status":  "received",
		"call_id": callID,
		"message": "Call queued for processing",
	})
}
