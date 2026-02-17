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
// @Summary List company users
// @Description Get a list of all users within the company
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
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
// @Description Invite a new user to the company and assign a role
// @Tags users
// @Accept json
// @Produce json
// @Param request body map[string]string true "User Invitation Request"
// @Success 201 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /users/invite [post]
func (h *UserHandler) InviteUser(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	var req struct {
		Email             string   `json:"email"`
		Emails            []string `json:"emails"`
		Role              string   `json:"role"`
		ManagerName       string   `json:"manager_name"`
		ManagerID         string   `json:"manager_id"`
		TemporaryPassword string   `json:"temporary_password"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	emails := req.Emails
	if req.Email != "" {
		emails = append(emails, req.Email)
	}

	if len(emails) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No emails provided"})
	}

	role := req.Role
	if role == "" {
		role = "sales_rep"
	}

	var invitedUsers []*domain.User
	for _, email := range emails {
		user := &domain.User{
			ID:           uuid.New().String(),
			CompanyID:    companyID,
			Email:        email,
			Role:         domain.UserRole(role),
			ManagerName:  req.ManagerName,
			ManagerID:    &req.ManagerID,
			PasswordHash: "invited", // In real app, hash the temporary password or handle via flow
			IsActive:     true,
		}
		if err := h.userRepo.Create(c.Context(), user); err != nil {
			// Skip duplicates or log error
			continue
		}
		invitedUsers = append(invitedUsers, user)
	}

	return c.Status(201).JSON(fiber.Map{
		"users":   invitedUsers,
		"message": "Invitations sent successfully",
	})
}

// GetUser godoc
// @Summary Get user details
// @Description Get details of a specific user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} domain.User
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
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
// @Summary Update user details
// @Description Update role or manager name for a user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param request body map[string]string true "User Update Request"
// @Success 200 {object} domain.User
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
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
// @Description Remove a user from the company
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 204
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /users/{id} [delete]
func (h *UserHandler) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	if err := h.userRepo.Delete(c.Context(), companyID, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
