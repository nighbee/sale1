package handlers

import (
	"github.com/gofiber/fiber/v2"
)

type CompanyHandler struct{}

func NewCompanyHandler() *CompanyHandler {
	return &CompanyHandler{}
}

func (h *CompanyHandler) UpdateSettings(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Settings updated (mock)"})
}
