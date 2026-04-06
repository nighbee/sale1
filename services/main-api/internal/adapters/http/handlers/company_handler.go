package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type CompanyHandler struct {
	companyRepo ports.CompanyRepository
}

func NewCompanyHandler(companyRepo ports.CompanyRepository) *CompanyHandler {
	return &CompanyHandler{
		companyRepo: companyRepo,
	}
}

// GetBilling godoc
// @Summary Get billing info
// @Description Get billing details, card info, and token usage
// @Tags settings
// @Accept json
// @Produce json
// @Success 200 {object} domain.BillingInfo
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /settings/billing [get]
func (h *CompanyHandler) GetBilling(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	billing, err := h.companyRepo.GetBillingInfo(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(billing)
}

// UpdateBilling godoc
// @Summary Update billing info
// @Description Update card details and billing preferences
// @Tags settings
// @Accept json
// @Produce json
// @Param request body domain.BillingInfo true "Billing Update Request"
// @Success 200 {object} domain.BillingInfo
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /settings/billing [put]
func (h *CompanyHandler) UpdateBilling(c *fiber.Ctx) error {
	var billing domain.BillingInfo
	if err := c.BodyParser(&billing); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	companyID := c.Locals("company_id").(string)
	billing.ID = companyID

	if err := h.companyRepo.UpdateBillingInfo(c.Context(), &billing); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(billing)
}
