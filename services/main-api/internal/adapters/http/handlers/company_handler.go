package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/billing"
)

type CompanyHandler struct {
	companyRepo     ports.CompanyRepository
	billingUseCase  *billing.BillingUseCase
	userRepo        ports.UserRepository
	integrationRepo ports.IntegrationRepository
}

func NewCompanyHandler(
	companyRepo ports.CompanyRepository,
	billingUseCase *billing.BillingUseCase,
	userRepo ports.UserRepository,
	integrationRepo ports.IntegrationRepository,
) *CompanyHandler {
	return &CompanyHandler{
		companyRepo:     companyRepo,
		billingUseCase:  billingUseCase,
		userRepo:        userRepo,
		integrationRepo: integrationRepo,
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
	billing, err := h.billingUseCase.GetBilling(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(billing)
}

// GetCompany godoc
// @Summary Get company settings
// @Description Get current company settings and profile
// @Tags settings
// @Accept json
// @Produce json
// @Success 200 {object} domain.Company
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /settings [get]
func (h *CompanyHandler) GetCompany(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	company, err := h.companyRepo.GetByID(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(company)
}

// UpdateSettings godoc
// @Summary Update company settings
// @Description Update company name, description, industry, size, and other general settings
// @Tags settings
// @Accept json
// @Produce json
// @Param request body domain.Company true "Settings Update Request"
// @Success 200 {object} domain.Company
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /settings [put]
func (h *CompanyHandler) UpdateSettings(c *fiber.Ctx) error {
	var update domain.Company
	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	companyID := c.Locals("company_id").(string)

	// Fetch current company to ensure we only update allowed fields
	company, err := h.companyRepo.GetByID(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Update allowed fields
	company.Name = update.Name
	company.Description = update.Description
	company.Industry = update.Industry
	company.Size = update.Size
	company.ManagersCount = update.ManagersCount
	company.TimeZone = update.TimeZone
	company.STTModelPreference = update.STTModelPreference
	company.LLMProvider = update.LLMProvider

	if err := h.companyRepo.Update(c.Context(), company); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(company)
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
	var req domain.BillingInfo
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	companyID := c.Locals("company_id").(string)

	updated, err := h.billingUseCase.UpdateBilling(c.Context(), companyID, &req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(updated)
}

// CreateSetupIntent godoc
// @Summary Create Stripe SetupIntent
// @Description Create a Stripe SetupIntent to securely collect payment method details on the frontend
// @Tags settings
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /settings/billing/setup-intent [post]
func (h *CompanyHandler) CreateSetupIntent(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	userID := c.Locals("user_id").(string)

	intentID, clientSecret, err := h.billingUseCase.CreateSetupIntent(c.Context(), companyID, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"intent_id":     intentID,
		"client_secret": clientSecret,
	})
}

// ListAllCompanies godoc
// @Summary List all companies (Admin)
// @Description List all companies in the system.
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/companies [get]
func (h *CompanyHandler) ListAllCompanies(c *fiber.Ctx) error {
	companies, err := h.companyRepo.List(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"companies": companies})
}

// GetCompanyDetails godoc
// @Summary Get company details (Admin)
// @Description Get company profile, users, and integrations.
// @Tags admin
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/companies/{id} [get]
func (h *CompanyHandler) GetCompanyDetails(c *fiber.Ctx) error {
	companyID := c.Params("id")

	company, err := h.companyRepo.GetByID(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	users, err := h.userRepo.List(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	integrations, err := h.integrationRepo.List(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"company":      company,
		"users":        users,
		"integrations": integrations,
	})
}

// UpdateCompanyGlobal godoc
// @Summary Update company (Admin)
// @Description Update any company field.
// @Tags admin
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param request body domain.Company true "Update Request"
// @Success 200 {object} domain.Company
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/companies/{id} [put]
func (h *CompanyHandler) UpdateCompanyGlobal(c *fiber.Ctx) error {
	companyID := c.Params("id")
	var update map[string]interface{}
	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	company, err := h.companyRepo.GetByID(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if val, ok := update["name"].(string); ok && val != "" {
		company.Name = val
	}
	if val, ok := update["description"].(string); ok {
		company.Description = val
	}
	if val, ok := update["industry"].(string); ok {
		company.Industry = val
	}
	if val, ok := update["size"].(string); ok {
		company.Size = val
	}
	if val, ok := update["managers_count"].(float64); ok {
		company.ManagersCount = int(val)
	}
	if val, ok := update["is_active"].(bool); ok {
		company.IsActive = val
	}

	if err := h.companyRepo.Update(c.Context(), company); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(company)
}
