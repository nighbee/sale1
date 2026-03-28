package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type AISettingsHandler struct {
	repo ports.AISettingsRepository
}

func NewAISettingsHandler(repo ports.AISettingsRepository) *AISettingsHandler {
	return &AISettingsHandler{repo: repo}
}

func (h *AISettingsHandler) Get(c *fiber.Ctx) error {
	settings, err := h.repo.Get(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(settings)
}

func (h *AISettingsHandler) GetInternal(c *fiber.Ctx) error {
	settings, err := h.repo.Get(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(settings)
}

func (h *AISettingsHandler) Update(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "update_ai_settings"))
	var req domain.AISettings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	if err := h.repo.Update(c.Context(), &req); err != nil {
		log.Error("update ai settings failed", zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	settings, _ := h.repo.Get(c.Context())
	return c.JSON(settings)
}
