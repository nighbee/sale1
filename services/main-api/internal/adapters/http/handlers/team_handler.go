package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/usecases/teams"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type TeamHandler struct {
	teamUC *teams.TeamUseCase
}

func NewTeamHandler(teamUC *teams.TeamUseCase) *TeamHandler {
	return &TeamHandler{teamUC: teamUC}
}

// Create godoc
// @Summary Create a new sales team
// @Description Create a new sales team
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
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "create_team"))
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		AutoAssign  bool   `json:"auto_assign"`
	}
	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	team, err := h.teamUC.Create(c.Context(), req.Name, req.Description, req.AutoAssign)
	if err != nil {
		log.Error("team creation failed", zap.String("name", req.Name), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Info("team created", zap.String("team_id", team.ID), zap.String("name", team.Name))
	return c.Status(201).JSON(team)
}

// List godoc
// @Summary List teams
// @Description Get a list of all sales teams
// @Tags teams
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams [get]
func (h *TeamHandler) List(c *fiber.Ctx) error {
	teams, err := h.teamUC.List(c.Context())
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
	id := c.Params("id")
	team, err := h.teamUC.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Team not found"})
	}
	return c.JSON(team)
}

// AddMember godoc
// @Summary Add a member to a team
// @Description Assign a user to a sales team
// @Tags teams
// @Accept json
// @Produce json
// @Param id path string true "Team ID"
// @Param request body map[string]string true "Add Member Request"
// @Success 200
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/{id}/members [post]
func (h *TeamHandler) AddMember(c *fiber.Ctx) error {
	id := c.Params("id")
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	if err := h.teamUC.AddMember(c.Context(), id, req.UserID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(200)
}

// RemoveMember godoc
// @Summary Remove a member from a team
// @Description Unassign a user from a sales team
// @Tags teams
// @Accept json
// @Produce json
// @Param id path string true "Team ID"
// @Param userID path string true "User ID"
// @Success 200
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/{id}/members/{userID} [delete]
func (h *TeamHandler) RemoveMember(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Params("userID")
	if err := h.teamUC.RemoveMember(c.Context(), id, userID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(200)
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
	id := c.Params("id")
	var team domain.Team
	if err := c.BodyParser(&team); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	team.ID = id
	if err := h.teamUC.Update(c.Context(), &team); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(team)
}

// Delete godoc
// @Summary Delete a team
// @Description Remove a sales team
// @Tags teams
// @Accept json
// @Produce json
// @Param id path string true "Team ID"
// @Success 204
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/{id} [delete]
func (h *TeamHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.teamUC.Delete(c.Context(), id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// Ensure godoc
// @Summary Ensure a team exists
// @Description Find or create a team by name and optionally add multiple members
// @Tags teams
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Ensure Team Request"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /teams/ensure [post]
func (h *TeamHandler) Ensure(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "ensure_team"))

	var req struct {
		TeamName string   `json:"team_name"`
		UserIDs  []string `json:"user_ids"`
	}

	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	if req.TeamName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "team_name is required"})
	}

	team, err := h.teamUC.EnsureTeamExists(c.Context(), req.TeamName, "")
	if err != nil {
		log.Error("ensure team failed", zap.String("team_name", req.TeamName), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var membersAdded, alreadyInTeam int

	if len(req.UserIDs) > 0 {
		var err error
		membersAdded, alreadyInTeam, err = h.teamUC.AddMultipleMembers(c.Context(), team.ID, req.UserIDs)
		if err != nil {
			log.Error("add members failed", zap.String("team_id", team.ID), zap.Error(err))
		}
	}

	log.Info("team ensured", zap.String("team_id", team.ID), zap.String("team_name", team.Name), zap.Int("members_added", membersAdded), zap.Int("already_in_team", alreadyInTeam))

	return c.Status(200).JSON(fiber.Map{
		"team_id":             team.ID,
		"team_name":           team.Name,
		"members_added":       membersAdded,
		"already_in_team":     alreadyInTeam,
		"total_user_ids_sent": len(req.UserIDs),
	})
}
