package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/usecases/teams"
)

type TeamHandler struct {
	teamUC *teams.TeamUseCase
}

func NewTeamHandler(teamUC *teams.TeamUseCase) *TeamHandler {
	return &TeamHandler{teamUC: teamUC}
}

// Create godoc
// @Summary Create a new sales team
// @Description Create a new sales team within the company
// @Tags teams
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Team Creation Request"
// @Success 201 {object} domain.Team
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams [post]
func (h *TeamHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		AutoAssign  bool   `json:"auto_assign"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	team, err := h.teamUC.Create(c.Context(), companyID, req.Name, req.Description, req.AutoAssign)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(team)
}

// List godoc
// @Summary List company teams
// @Description Get a list of all sales teams within the company
// @Tags teams
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams [get]
func (h *TeamHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	teams, err := h.teamUC.ListByCompany(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"teams": teams})
}

// Get godoc
// @Summary Get team details
// @Description Get details of a specific sales team
// @Tags teams
// @Accept json
// @Produce json
// @Param id path string true "Team ID"
// @Success 200 {object} domain.Team
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/{id} [get]
func (h *TeamHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	id := c.Params("id")
	team, err := h.teamUC.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Team not found"})
	}
	return c.JSON(team)
}

// Update godoc
// @Summary Update team details
// @Description Update name or description for a sales team
// @Tags teams
// @Accept json
// @Produce json
// @Param id path string true "Team ID"
// @Param request body domain.Team true "Team Update Request"
// @Success 200 {object} domain.Team
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/{id} [put]
func (h *TeamHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	id := c.Params("id")
	var team domain.Team
	if err := c.BodyParser(&team); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	team.ID = id
	team.CompanyID = companyID
	if err := h.teamUC.Update(c.Context(), &team); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(team)
}

// Delete godoc
// @Summary Delete a team
// @Description Remove a sales team from the company
// @Tags teams
// @Accept json
// @Produce json
// @Param id path string true "Team ID"
// @Success 204
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/{id} [delete]
func (h *TeamHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	id := c.Params("id")
	if err := h.teamUC.Delete(c.Context(), companyID, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
