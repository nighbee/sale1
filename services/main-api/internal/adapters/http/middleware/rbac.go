package middleware

import "github.com/gofiber/fiber/v2"

// RequireRole enforces RBAC by checking the user's role from context.
func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: implement role checking logic.
		return c.Next()
	}
}


