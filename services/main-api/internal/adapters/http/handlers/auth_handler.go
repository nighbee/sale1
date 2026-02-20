package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/auth"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

var _ = ports.TokenPair{}

type AuthHandler struct {
	registerUC *auth.RegisterUseCase
	loginUC    *auth.LoginUseCase
	refreshUC  *auth.RefreshUseCase
}

func NewAuthHandler(
	registerUC *auth.RegisterUseCase,
	loginUC *auth.LoginUseCase,
	refreshUC *auth.RefreshUseCase,
) *AuthHandler {
	return &AuthHandler{
		registerUC: registerUC,
		loginUC:    loginUC,
		refreshUC:  refreshUC,
	}
}

// Register godoc
// @Summary Register a new company and admin user
// @Description Register a new company along with a super_admin user
// @Tags auth
// @Accept json
// @Produce json
// @Param request body auth.RegisterRequest true "Registration Request"
// @Success 201 {object} auth.RegisterResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c.Locals).With(zap.String("operation", "register"))
	var req auth.RegisterRequest

	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	log.Info("registration requested", zap.String("email", req.Email), zap.String("company", req.CompanyName))

	resp, err := h.registerUC.Execute(c.Context(), &req)
	if err != nil {
		log.Error("registration failed", zap.String("email", req.Email), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	log.Info("registration successful", zap.String("email", req.Email), zap.String("company_id", resp.Company.ID))
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// Login godoc
// @Summary Login user
// @Description Login with email and password to receive JWT tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param request body auth.LoginRequest true "Login Request"
// @Success 200 {object} auth.LoginResponse
// @Failure 401 {object} fiber.Map
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c.Locals).With(zap.String("operation", "login"))
	var req auth.LoginRequest

	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	resp, err := h.loginUC.Execute(c.Context(), &req)
	if err != nil {
		log.Warn("login failed", zap.String("email", req.Email), zap.Error(err))
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	log.Info("login successful", zap.String("email", req.Email))
	return c.JSON(resp)
}

// Refresh godoc
// @Summary Refresh access token
// @Description Get a new access token using a valid refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Refresh Request"
// @Success 200 {object} ports.TokenPair
// @Failure 401 {object} fiber.Map
// @Router /auth/refresh [post]
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c.Locals).With(zap.String("operation", "refresh_token"))
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	resp, err := h.refreshUC.Execute(c.Context(), req.RefreshToken)
	if err != nil {
		log.Warn("token refresh failed", zap.Error(err))
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	log.Debug("token refreshed successfully")
	return c.JSON(resp)
}

// Logout godoc
// @Summary Logout user
// @Description Logout user and invalidate session (client-side)
// @Tags auth
// @Success 204
// @Router /auth/logout [post]
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c.Locals).With(zap.String("operation", "logout"))
	log.Info("user logged out", zap.String("user_id", func() string {
		if v, ok := c.Locals("user_id").(string); ok {
			return v
		}
		return ""
	}()))
	// In a stateless JWT implementation, logout usually happens on the client side
	// by deleting the token. Server-side logout would require a blacklist.
	// For this task, we'll just return success.
	return c.SendStatus(fiber.StatusNoContent)
}
