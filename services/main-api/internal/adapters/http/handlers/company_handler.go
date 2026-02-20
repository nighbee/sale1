package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type CompanyHandler struct {
	companyRepo ports.CompanyRepository
}

func NewCompanyHandler(companyRepo ports.CompanyRepository) *CompanyHandler {
	return &CompanyHandler{
		companyRepo: companyRepo,
	}
}

// GetCompany godoc
// @Summary Get company details
// @Description Get basic information and settings for a company
// @Tags companies
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Success 200 {object} domain.Company
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /companies/{id} [get]
func (h *CompanyHandler) GetCompany(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c.Locals).With(zap.String("operation", "get_company"))
	id := c.Params("id")
	company, err := h.companyRepo.GetByID(c.Context(), id)
	if err != nil {
		log.Warn("company not found", zap.String("company_id", id), zap.Error(err))
		return c.Status(404).JSON(fiber.Map{"error": "Company not found"})
	}
	log.Debug("company fetched", zap.String("company_id", id))
	return c.JSON(company)
}

// UpdateSettings godoc
// @Summary Update company settings
// @Description Update AI preferences (STT model, LLM provider) for a company
// @Tags companies
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param request body map[string]interface{} true "Settings Update Request"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /companies/{id}/settings [put]
func (h *CompanyHandler) UpdateSettings(c *fiber.Ctx) error {
	id := c.Params("id")

	company, err := h.companyRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Company not found"})
	}

	var update struct {
		Name               string `json:"name"`
		Description        string `json:"description"`
		Industry           string `json:"industry"`
		Size               string `json:"size"`
		TimeZone           string `json:"time_zone"`
		STTModelPreference string `json:"stt_model_preference"`
		LLMProvider        string `json:"llm_provider"`
	}

	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	if update.Name != "" {
		company.Name = update.Name
	}
	if update.Description != "" {
		company.Description = update.Description
	}
	if update.Industry != "" {
		company.Industry = update.Industry
	}
	if update.Size != "" {
		company.Size = update.Size
	}
	if update.TimeZone != "" {
		company.TimeZone = update.TimeZone
	}
	if update.STTModelPreference != "" {
		company.STTModelPreference = domain.STTModel(update.STTModelPreference)
	}
	if update.LLMProvider != "" {
		company.LLMProvider = domain.LLMProvider(update.LLMProvider)
	}

	if err := h.companyRepo.Update(c.Context(), company); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "Settings updated successfully",
		"company": company,
	})
}

// GetBilling godoc
// @Summary Get company billing info
// @Description Get billing details, card info, and token usage for a company
// @Tags companies
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Success 200 {object} domain.BillingInfo
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /companies/{id}/billing [get]
func (h *CompanyHandler) GetBilling(c *fiber.Ctx) error {
	companyID := c.Params("id")
	billing, err := h.companyRepo.GetBillingInfo(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(billing)
}

// UpdateBilling godoc
// @Summary Update company billing info
// @Description Update card details and billing preferences
// @Tags companies
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param request body domain.BillingInfo true "Billing Update Request"
// @Success 200 {object} domain.BillingInfo
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /companies/{id}/billing [put]
func (h *CompanyHandler) UpdateBilling(c *fiber.Ctx) error {
	companyID := c.Params("id")
	var billing domain.BillingInfo
	if err := c.BodyParser(&billing); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}
	billing.CompanyID = companyID
	if err := h.companyRepo.UpdateBillingInfo(c.Context(), &billing); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(billing)
}
