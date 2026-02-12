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
// @Summary Get team performance metrics
// @Description Aggregate KPIs and quality scores for all managers in the company
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param period query string false "Time period (last_7_days, last_30_days, etc.)"
// @Success 200 {object} map[string]interface{}
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
// @Summary Get sales representative leaderboard
// @Description Rank managers by overall quality and KPI
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
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
