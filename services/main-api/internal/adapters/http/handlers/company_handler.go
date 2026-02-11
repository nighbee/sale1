package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
)

type CompanyHandler struct {
	companyRepo ports.CompanyRepository
}

func NewCompanyHandler(companyRepo ports.CompanyRepository) *CompanyHandler {
	return &CompanyHandler{companyRepo: companyRepo}
}

func (h *CompanyHandler) GetCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	if id != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	company, err := h.companyRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Company not found"})
	}
	return c.JSON(company)
}

func (h *CompanyHandler) UpdateSettings(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Settings updated (mock)"})
}
