package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/domain"
)

type CompanyHandler struct {
	companyRepo ports.CompanyRepository
}

func NewCompanyHandler(companyRepo ports.CompanyRepository) *CompanyHandler {
	return &CompanyHandler{
		companyRepo: companyRepo,
	}
}

func (h *CompanyHandler) GetCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	company, err := h.companyRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Company not found"})
	}
	return c.JSON(company)
}

func (h *CompanyHandler) UpdateSettings(c *fiber.Ctx) error {
	id := c.Params("id")

	company, err := h.companyRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Company not found"})
	}

	var update struct {
		STTModelPreference string `json:"stt_model_preference"`
		LLMProvider        string `json:"llm_provider"`
	}

	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
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
