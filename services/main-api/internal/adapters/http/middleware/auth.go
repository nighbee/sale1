package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
)

func JWTAuth(jwtService ports.JWTService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		var tokenString string

		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// Fallback to query parameter for WebSockets
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authentication token",
			})
		}

		claims, err := jwtService.ValidateToken(tokenString)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid token",
			})
		}

		// Store claims in context
		c.Locals("user_id", claims["user_id"])
		c.Locals("company_id", claims["company_id"])
		c.Locals("role", claims["role"])
		c.Locals("email", claims["email"])

		return c.Next()
	}
}
