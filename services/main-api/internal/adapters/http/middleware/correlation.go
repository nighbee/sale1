package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// CorrelationID injects an X-Correlation-ID header into every request.
// If the client already sends one it is reused; otherwise a new UUID is generated.
// The value is stored in Fiber locals under the key "correlation_id" so that
// any handler can retrieve it via  c.Locals("correlation_id").(string).
func CorrelationID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		corrID := c.Get("X-Correlation-ID")
		if corrID == "" {
			corrID = uuid.New().String()
		}
		c.Locals("correlation_id", corrID)
		c.Set("X-Correlation-ID", corrID)
		return c.Next()
	}
}
