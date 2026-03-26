package middleware

import (
	"os"

	"github.com/gofiber/fiber/v2"
)

func InternalAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		secret := c.Get("X-Internal-Secret")
		internalSecret := os.Getenv("INTERNAL_SECRET")
		if internalSecret == "" {
			internalSecret = "internal-secret-key"
		}

		if secret == "" || secret != internalSecret {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Forbidden: internal access only",
			})
		}

		return c.Next()
	}
}
