package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type NotificationHandler struct {
	repo ports.NotificationRepository
}

func NewNotificationHandler(repo ports.NotificationRepository) *NotificationHandler {
	return &NotificationHandler{repo: repo}
}

// ListNotifications godoc
// @Summary List user notifications
// @Description Get a list of alerts and notifications for the current user
// @Tags notifications
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /notifications [get]
func (h *NotificationHandler) ListNotifications(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "list_notifications"))
	userID := c.Locals("user_id").(string)
	notifications, err := h.repo.ListByUser(c.Context(), userID)
	if err != nil {
		log.Error("list notifications failed", zap.String("user_id", userID), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Debug("notifications listed", zap.String("user_id", userID), zap.Int("count", len(notifications)))
	return c.JSON(fiber.Map{"notifications": notifications})
}

// MarkAsRead godoc
// @Summary Mark notification as read
// @Description Update the status of a notification to read
// @Tags notifications
// @Accept json
// @Produce json
// @Param id path string true "Notification ID"
// @Success 204
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /notifications/{id}/read [put]
func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "mark_notification_read"))
	userID := c.Locals("user_id").(string)
	id := c.Params("id")
	if err := h.repo.MarkAsRead(c.Context(), userID, id); err != nil {
		log.Error("mark notification read failed", zap.String("user_id", userID), zap.String("notification_id", id), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Debug("notification marked as read", zap.String("user_id", userID), zap.String("notification_id", id))
	return c.SendStatus(204)
}
