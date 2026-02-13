package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
)

type NotificationHandler struct {
	repo ports.NotificationRepository
}

func NewNotificationHandler(repo ports.NotificationRepository) *NotificationHandler {
	return &NotificationHandler{repo: repo}
}

func (h *NotificationHandler) ListNotifications(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	notifications, err := h.repo.ListByUser(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"notifications": notifications})
}

func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	id := c.Params("id")
	if err := h.repo.MarkAsRead(c.Context(), userID, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
