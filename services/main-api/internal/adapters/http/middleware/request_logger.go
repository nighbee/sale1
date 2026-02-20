package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

// RequestLogger logs every HTTP request/response using the global zap logger.
// It must be placed AFTER CorrelationID() so the correlation_id local is already set.
func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process the request
		err := c.Next()

		duration := time.Since(start)
		status := c.Response().StatusCode()
		corrID, _ := c.Locals("correlation_id").(string)
		userID, _ := c.Locals("user_id").(string)

		fields := []zap.Field{
			zap.String("correlation_id", corrID),
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.String("query", string(c.Request().URI().QueryString())),
			zap.Int("status", status),
			zap.Int64("duration_ms", duration.Milliseconds()),
			zap.String("ip", c.IP()),
			zap.String("user_agent", c.Get("User-Agent")),
		}
		if userID != "" {
			fields = append(fields, zap.String("user_id", userID))
		}

		log := logger.L.With(fields...)

		switch {
		case status >= 500:
			log.Error("request failed")
		case status >= 400:
			log.Warn("request error")
		default:
			log.Info("request completed")
		}

		return err
	}
}
