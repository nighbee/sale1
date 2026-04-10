package handlers

import (
	"encoding/json"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	userRepo    ports.UserRepository
	listCallsUC *calls.ListCallsUseCase
}

func NewUserHandler(userRepo ports.UserRepository, listCallsUC *calls.ListCallsUseCase) *UserHandler {
	return &UserHandler{
		userRepo:    userRepo,
		listCallsUC: listCallsUC,
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
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "list_users"))
	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	users, err := h.userRepo.List(c.Context(), companyID)
	if err != nil {
		log.Error("list users failed", zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Debug("users listed", zap.Int("count", len(users)))
	return c.JSON(fiber.Map{"users": users})
}

// InviteUser godoc
// @Summary Invite a new user
// @Description Invite a new user and assign a role
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
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "invite_user"))
	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	var req struct {
		Email             string   `json:"email"`
		Emails            []string `json:"emails"`
		Role              string   `json:"role"`
		ManagerName       string   `json:"manager_name"`
		ManagerID         string   `json:"manager_id"`
		TemporaryPassword string   `json:"temporary_password"`
		TeamID            string   `json:"team_id"`
		FirstName         string   `json:"first_name"`
		LastName          string   `json:"last_name"`
		Username          string   `json:"username"`
		Phone             string   `json:"phone"`
	}

	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	reqJson, _ := json.Marshal(req)
	log.Debug("InviteUser request parsed", zap.String("payload", string(reqJson)))

	emails := req.Emails
	if req.Email != "" {
		emails = append(emails, req.Email)
	}

	var teamIDPtr *string
	if req.TeamID != "" {
		tID := req.TeamID
		teamIDPtr = &tID
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
		existingUser, err := h.userRepo.GetByEmail(c.Context(), email)
		if err == nil && existingUser != nil {
			invitedUsers = append(invitedUsers, existingUser)
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.TemporaryPassword), bcrypt.DefaultCost)
		if err != nil {
			continue
		}

		user := &domain.User{
			ID:           uuid.New().String(),
			CompanyID:    companyID,
			Email:        email,
			Role:         domain.UserRole(role),
			ManagerName:  req.ManagerName,
			ManagerID:    &req.ManagerID,
			PasswordHash: string(hash),
			TeamID:       teamIDPtr,
			IsActive:     true,
			FirstName:    req.FirstName,
			LastName:     req.LastName,
			Username:     req.Username,
			Phone:        req.Phone,
		}
		if err := h.userRepo.Create(c.Context(), user); err != nil {
			continue
		}
		invitedUsers = append(invitedUsers, user)
	}

	log.Info("users invited", zap.Int("count", len(invitedUsers)))
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
	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	user, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil || user.CompanyID != companyID {
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
	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	user, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil || user.CompanyID != companyID {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	var update struct {
		FirstName   string `json:"first_name"`
		LastName    string `json:"last_name"`
		Email       string `json:"email"`
		Password    string `json:"password"`
		ManagerName string `json:"manager_name"`
		Role        string `json:"role"`
		Username    string `json:"username"`
		Phone       string `json:"phone"`
		TeamID      string `json:"team_id"`
	}

	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	if update.FirstName != "" {
		user.FirstName = update.FirstName
	}
	if update.LastName != "" {
		user.LastName = update.LastName
	}
	if update.Email != "" {
		user.Email = update.Email
	}
	if update.Password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(update.Password), bcrypt.DefaultCost)
		user.PasswordHash = string(hash)
	}
	if update.ManagerName != "" {
		user.ManagerName = update.ManagerName
	}
	if update.Role != "" {
		user.Role = domain.UserRole(update.Role)
	}
	if update.Username != "" {
		user.Username = update.Username
	}
	if update.Phone != "" {
		user.Phone = update.Phone
	}
	if update.TeamID != "" {
		if update.TeamID == "none" || update.TeamID == "null" {
			user.TeamID = nil
		} else {
			tID := update.TeamID
			user.TeamID = &tID
		}
	}

	if err := h.userRepo.Update(c.Context(), user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

// GetMe godoc
// @Summary Get current user profile
// @Description Get profile details of the currently authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {object} domain.User
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /user/me [get]
func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	id := c.Locals("user_id").(string)
	user, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

// DeleteUser godoc
// @Summary Delete a user
// @Description Remove a user
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
	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	user, err := h.userRepo.GetByID(c.Context(), id)
	if err != nil || user.CompanyID != companyID {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if err := h.userRepo.Delete(c.Context(), id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// GetUserCalls godoc
// @Summary Get user's calls
// @Description Get a paginated list of calls for a specific user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Page limit" default(20)
// @Success 200 {object} calls.ListCallsResponse
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /users/{id}/calls [get]
func (h *UserHandler) GetUserCalls(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_user_calls"))
	targetUserID := c.Params("id")

	// Get target user
	user, err := h.userRepo.GetByID(c.Context(), targetUserID)
	if err != nil {
		log.Warn("user not found", zap.String("user_id", targetUserID), zap.Error(err))
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Auth check: allow access if requester is super_admin or tenant_admin,
	// or requester is the user themselves, or requester is the manager of the user.
	requesterID, _ := c.Locals("user_id").(string)
	requesterRole, _ := c.Locals("role").(string)

	if requesterRole != string(domain.RoleSuperAdmin) && requesterRole != string(domain.RoleTenantAdmin) && requesterID != targetUserID {
		// not admin and not the user themselves -> check manager relationship
		if user.ManagerID == nil || *user.ManagerID == "" || *user.ManagerID != requesterID {
			log.Warn("forbidden access to user calls",
				zap.String("requester_id", requesterID),
				zap.String("target_user_id", targetUserID),
				zap.Stringp("target_manager_id", user.ManagerID))
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
		}
	}

	if user.ManagerID == nil || *user.ManagerID == "" {
		log.Debug("user has no manager_id, returning empty calls list", zap.String("user_id", targetUserID))
		return c.JSON(calls.ListCallsResponse{
			Calls: []*domain.Call{},
			Total: 0,
			Page:  1,
			Limit: 20,
		})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	log.Debug("fetching calls for user",
		zap.String("user_id", targetUserID),
		zap.String("manager_id", *user.ManagerID),
		zap.Int("page", page),
		zap.Int("limit", limit))

	resp, err := h.listCallsUC.Execute(c.Context(), calls.ListCallsRequest{
		CompanyID: user.CompanyID,
		ManagerID: *user.ManagerID,
		Page:      page,
		Limit:     limit,
	})

	if err != nil {
		log.Error("failed to fetch user calls", zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

// ListAllUsers godoc
// @Summary List all users (Admin)
// @Description List all users in the system.
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/users [get]
func (h *UserHandler) ListAllUsers(c *fiber.Ctx) error {
	users, err := h.userRepo.ListAll(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"users": users})
}

// UpdateUserGlobal godoc
// @Summary Update user (Admin)
// @Description Update any user field.
// @Tags admin
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param request body domain.User true "Update Request"
// @Success 200 {object} domain.User
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/users/{id} [put]
func (h *UserHandler) UpdateUserGlobal(c *fiber.Ctx) error {
	userID := c.Params("id")
	var update map[string]interface{}
	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	user, err := h.userRepo.GetByID(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if val, ok := update["first_name"].(string); ok {
		user.FirstName = val
	}
	if val, ok := update["last_name"].(string); ok {
		user.LastName = val
	}
	if val, ok := update["role"].(string); ok && val != "" {
		user.Role = domain.UserRole(val)
	}
	if val, ok := update["is_active"].(bool); ok {
		user.IsActive = val
	}

	if err := h.userRepo.Update(c.Context(), user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}
