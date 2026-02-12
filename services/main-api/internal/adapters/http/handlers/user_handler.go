package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/google/uuid"
	"github.com/salesai/main-api/internal/core/domain"
)

type UserHandler struct {
	userRepo ports.UserRepository
}

func NewUserHandler(userRepo ports.UserRepository) *UserHandler {
	return &UserHandler{
		userRepo: userRepo,
	}
}

// ListUsers godoc
// @Summary List all users in company
// @Description Get a list of all users belonging to the company
// @Tags Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Router /users [get]
func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	users, err := h.userRepo.ListByCompany(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"users": users})
}

// InviteUser godoc
// @Summary Invite a new user
// @Description Create a new user record and send an invitation
// @Tags Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body map[string]string true "Invite User Request (email, role, manager_name, manager_id)"
// @Success 201 {object} map[string]interface{}
// @Router /users/invite [post]
func (h *UserHandler) InviteUser(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	var req struct {
		Email       string `json:"email"`
		Role        string `json:"role"`
		ManagerName string `json:"manager_name"`
		ManagerID   string `json:"manager_id"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	user := &domain.User{
		ID:           uuid.New().String(),
		CompanyID:    companyID,
		Email:        req.Email,
		Role:         domain.UserRole(req.Role),
		ManagerName:  req.ManagerName,
		ManagerID:    &req.ManagerID,
		PasswordHash: "invited", // Should be handled by a proper invitation flow
		IsActive:     true,
	}

	if err := h.userRepo.Create(c.Context(), user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{
		"user":    user,
		"message": "Invitation email sent (mocked)",
	})
}

// GetUser godoc
// @Summary Get user details
// @Description Get information about a specific user
// @Tags Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} domain.User
// @Router /users/{id} [get]
func (h *UserHandler) GetUser(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	user, err := h.userRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

// UpdateUser godoc
// @Summary Update user information
// @Description Update the role or manager name of a user
// @Tags Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Param request body map[string]string true "Update User Request (manager_name, role)"
// @Success 200 {object} domain.User
// @Router /users/{id} [put]
func (h *UserHandler) UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	user, err := h.userRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	var update struct {
		ManagerName string `json:"manager_name"`
		Role        string `json:"role"`
	}

	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	if update.ManagerName != "" {
		user.ManagerName = update.ManagerName
	}
	if update.Role != "" {
		user.Role = domain.UserRole(update.Role)
	}

	if err := h.userRepo.Update(c.Context(), user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

// DeleteUser godoc
// @Summary Delete a user
// @Description Permanently remove a user from the company
// @Tags Users
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 204
// @Router /users/{id} [delete]
func (h *UserHandler) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	if err := h.userRepo.Delete(c.Context(), companyID, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
