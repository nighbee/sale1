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

// GetTeamPerformance godoc
// @Summary Get team performance analytics
// @Description Get a breakdown of performance metrics per manager
// @Tags analytics
// @Accept json
// @Produce json
// @Param period query string false "Time period (e.g., last_30_days)"
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /analytics/team-performance [get]
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

// GetLeaderboard godoc
// @Summary Get sales leaderboard
// @Description Get a ranked list of managers based on their KPI scores
// @Tags analytics
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /analytics/leaderboard [get]
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
