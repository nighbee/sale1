package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/usecases/integrations"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type IntegrationHandler struct {
	integrationUC *integrations.IntegrationUseCase
}

func NewIntegrationHandler(integrationUC *integrations.IntegrationUseCase) *IntegrationHandler {
	return &IntegrationHandler{integrationUC: integrationUC}
}

// Save godoc
// @Summary Create or update an integration
// @Description Create or update a third-party integration (AmoCRM, Google Sheets, etc.)
// @Tags integrations
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Integration Save Request"
// @Success 200 {object} domain.Integration
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /integrations [post]
func (h *IntegrationHandler) Save(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "save_integration"))
	var req struct {
		IntegrationType string          `json:"integration_type"`
		Credentials     json.RawMessage `json:"credentials"`
		Config          json.RawMessage `json:"config"`
		IsActive        bool            `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		log.Warn("body parse error", zap.Error(err))
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	log.Info("saving integration", zap.String("type", req.IntegrationType), zap.Bool("active", req.IsActive))
	integration, err := h.integrationUC.Save(c.Context(), domain.IntegrationType(req.IntegrationType), req.Credentials, req.Config, req.IsActive)
	if err != nil {
		log.Error("save integration failed", zap.String("type", req.IntegrationType), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Info("integration saved", zap.String("integration_id", integration.ID))
	return c.JSON(integration)
}

// List godoc
// @Summary List integrations
// @Description Get a list of all integrations
// @Tags integrations
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /integrations [get]
func (h *IntegrationHandler) List(c *fiber.Ctx) error {
	integrations, err := h.integrationUC.List(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"integrations": integrations})
}

// ListInternal godoc
// @Summary List all active integrations (Internal)
// @Description Internal endpoint to get all active integrations.
// @Tags integrations
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /internal/integrations [get]
func (h *IntegrationHandler) ListInternal(c *fiber.Ctx) error {
	secret := c.Get("X-Internal-Secret")
	internalSecret := os.Getenv("INTERNAL_SECRET")
	if internalSecret == "" {
		internalSecret = "internal-secret-key"
	}

	if secret == "" || secret != internalSecret {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden: internal access only"})
	}
	integrations, err := h.integrationUC.ListAllActive(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"integrations": integrations})
}

// Get godoc
// @Summary Get integration details
// @Description Get details of a specific integration by type
// @Tags integrations
// @Accept json
// @Produce json
// @Param type path string true "Integration Type (amocrm, google_sheets, telegram, slack)"
// @Success 200 {object} domain.Integration
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /integrations/{type} [get]
func (h *IntegrationHandler) Get(c *fiber.Ctx) error {
	it := c.Params("type")
	integration, err := h.integrationUC.GetByType(c.Context(), domain.IntegrationType(it))
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Integration not found"})
	}
	return c.JSON(integration)
}

// TestConnection godoc
// @Summary Test integration connectivity
// @Description Verify credentials and configuration for a specific integration
// @Tags integrations
// @Produce json
// @Param type path string true "Integration Type"
// @Param request body map[string]interface{} false "Temporary credentials to test"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /integrations/{type}/test [post]
func (h *IntegrationHandler) TestConnection(c *fiber.Ctx) error {
	it := c.Params("type")
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "test_integration"), zap.String("type", it))

	var req struct {
		Credentials json.RawMessage `json:"credentials"`
		Config      json.RawMessage `json:"config"`
	}
	c.BodyParser(&req)

	err := h.integrationUC.TestConnection(c.Context(), domain.IntegrationType(it), req.Credentials, req.Config)
	if err != nil {
		log.Warn("test connection failed", zap.Error(err))
		return c.Status(200).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	log.Info("test connection successful")
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Connection successful",
	})
}

// Delete godoc
// @Summary Delete an integration
// @Description Remove a third-party integration
// @Tags integrations
// @Accept json
// @Produce json
// @Param type path string true "Integration Type"
// @Success 204
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /integrations/{type} [delete]
func (h *IntegrationHandler) Delete(c *fiber.Ctx) error {
	it := c.Params("type")
	if err := h.integrationUC.Delete(c.Context(), domain.IntegrationType(it)); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// TriggerSheetSync godoc
// @Summary Trigger Google Sheets sync
// @Description Trigger an immediate sync cycle on the sheets-sync service
// @Tags integrations
// @Produce json
// @Success 202 {object} fiber.Map
// @Failure 502 {object} fiber.Map
// @Security BearerAuth
// @Router /integrations/google-sheets/sync [post]
func (h *IntegrationHandler) TriggerSheetSync(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "trigger_sheet_sync"))
	sheetsSyncURL := os.Getenv("SHEETS_SYNC_URL")
	if sheetsSyncURL == "" {
		sheetsSyncURL = "http://sheets-sync:8085"
	}
	url := sheetsSyncURL + "/sync"
	log.Info("Forwarding sync trigger to sheets-sync", zap.String("url", url))
	// Use an http client with a conservative timeout so the main-api
	// doesn't hang indefinitely if the sheets-sync service is slow or
	// unreachable.
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(url, "application/json", nil) //nolint:noctx
	if err != nil {
		log.Error("sheets-sync unreachable", zap.Error(err))
		return c.Status(502).JSON(fiber.Map{"error": "sheets-sync service unavailable"})
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"status":   "accepted",
		"upstream": string(body),
	})
}
