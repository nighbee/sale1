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

// ListNotifications godoc
// @Summary List user notifications
// @Description Get all notifications for the current user
// @Tags Notifications
// @Security BearerAuth
// @Success 200 {array} map[string]interface{}
// @Router /notifications [get]
func (h *NotificationHandler) ListNotifications(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	notifications, err := h.repo.ListByUser(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(notifications)
}

// MarkRead godoc
// @Summary Mark notification as read
// @Description Update notification status to read
// @Tags Notifications
// @Security BearerAuth
// @Param id path string true "Notification ID"
// @Success 200 {object} map[string]string
// @Router /notifications/{id}/read [put]
func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.repo.MarkAsRead(c.Context(), id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Notification marked as read"})
}
