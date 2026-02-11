package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/usecases/users"
	"github.com/salesai/main-api/internal/core/ports"
)

type UserHandler struct {
	listUsersUC   *users.ListUsersUseCase
	inviteUserUC *users.InviteUserUseCase
	updateUserUC *users.UpdateUserUseCase
	userRepo     ports.UserRepository
}

func NewUserHandler(
	listUsersUC *users.ListUsersUseCase,
	inviteUserUC *users.InviteUserUseCase,
	updateUserUC *users.UpdateUserUseCase,
	userRepo ports.UserRepository,
) *UserHandler {
	return &UserHandler{
		listUsersUC:   listUsersUC,
		inviteUserUC: inviteUserUC,
		updateUserUC: updateUserUC,
		userRepo:     userRepo,
	}
}

func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	users, err := h.listUsersUC.Execute(c.Context(), companyID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

func (h *UserHandler) InviteUser(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	var req users.InviteUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	user, err := h.inviteUserUC.Execute(c.Context(), companyID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(user)
}

func (h *UserHandler) GetUser(c *fiber.Ctx) error {
	id := c.Params("id")
	user, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	// Basic multi-tenancy check
	if user.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	return c.JSON(user)
}

func (h *UserHandler) UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var req users.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	// Check if user exists and belongs to company
	existing, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	if existing.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	user, err := h.updateUserUC.Execute(c.Context(), id, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(user)
}

func (h *UserHandler) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	// Check if user exists and belongs to company
	existing, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	if existing.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	err = h.userRepo.Delete(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
