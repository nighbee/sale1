package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
)

type AnalyticsHandler struct {
	analysisRepo ports.AnalysisRepository
}

func NewAnalyticsHandler(analysisRepo ports.AnalysisRepository) *AnalyticsHandler {
	return &AnalyticsHandler{analysisRepo: analysisRepo}
}

func (h *AnalyticsHandler) GetTeamPerformance(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	results, err := h.analysisRepo.GetTeamPerformance(c.Context(), companyID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(results)
}

func (h *AnalyticsHandler) GetLeaderboard(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	results, err := h.analysisRepo.GetLeaderboard(c.Context(), companyID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(results)
}

func (h *AnalyticsHandler) GetTrends(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Trends analytics (mock)"})
}
