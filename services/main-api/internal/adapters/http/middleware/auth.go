package middleware

import "github.com/gofiber/fiber/v2"

// Auth middleware will validate JWT tokens and set user context.
func Auth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: implement JWT validation and context population.
		return c.Next()
	}
}


