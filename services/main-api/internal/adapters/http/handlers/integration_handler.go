package handlers

import (
	"encoding/json"
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/usecases/integrations"
)

type IntegrationHandler struct {
	integrationUC *integrations.IntegrationUseCase
}

func NewIntegrationHandler(integrationUC *integrations.IntegrationUseCase) *IntegrationHandler {
	return &IntegrationHandler{integrationUC: integrationUC}
}

func (h *IntegrationHandler) Save(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	var req struct {
		IntegrationType string          `json:"integration_type"`
		Credentials     json.RawMessage `json:"credentials"`
		Config          json.RawMessage `json:"config"`
		IsActive        bool            `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	integration, err := h.integrationUC.Save(c.Context(), companyID, domain.IntegrationType(req.IntegrationType), req.Credentials, req.Config, req.IsActive)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(integration)
}

func (h *IntegrationHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	integrations, err := h.integrationUC.ListByCompany(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"integrations": integrations})
}

func (h *IntegrationHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	it := c.Params("type")
	integration, err := h.integrationUC.GetByType(c.Context(), companyID, domain.IntegrationType(it))
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Integration not found"})
	}
	return c.JSON(integration)
}

func (h *IntegrationHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	it := c.Params("type")
	if err := h.integrationUC.Delete(c.Context(), companyID, domain.IntegrationType(it)); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
