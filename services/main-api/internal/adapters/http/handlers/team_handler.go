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

func (h *TeamHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	teams, err := h.teamUC.ListByCompany(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"teams": teams})
}

func (h *TeamHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	id := c.Params("id")
	team, err := h.teamUC.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Team not found"})
	}
	return c.JSON(team)
}

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

func (h *TeamHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	id := c.Params("id")
	if err := h.teamUC.Delete(c.Context(), companyID, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
