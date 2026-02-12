package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
)

type AnalyticsHandler struct {
	teamPerformanceUC *analytics.TeamPerformanceUseCase
}

func NewAnalyticsHandler(teamPerformanceUC *analytics.TeamPerformanceUseCase) *AnalyticsHandler {
	return &AnalyticsHandler{
		teamPerformanceUC: teamPerformanceUC,
	}
}

func (h *AnalyticsHandler) GetTeamPerformance(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	filters := map[string]interface{}{
		"period": c.Query("period"),
	}

	result, err := h.teamPerformanceUC.Execute(c.Context(), companyID, filters)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"period":   filters["period"],
		"managers": result,
	})
}

func (h *AnalyticsHandler) GetLeaderboard(c *fiber.Ctx) error {
	// For simplicity, we use same data for leaderboard but sorted by KPI in repo if needed
	// or just reusing team performance for now as per contract similarities
	companyID := c.Locals("company_id").(string)

	result, err := h.teamPerformanceUC.Execute(c.Context(), companyID, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"leaderboard": result,
	})
}
