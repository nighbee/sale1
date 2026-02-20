package logger

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// L is the global application logger. Call Init() before using it.
var L *zap.Logger

// Init initialises the global zap logger for the given service name.
// LOG_LEVEL env var controls verbosity: debug | info | warn | error (default: info).
func Init(service string) {
	level := zap.InfoLevel
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		level = zap.DebugLevel
	case "warn":
		level = zap.WarnLevel
	case "error":
		level = zap.ErrorLevel
	}

	encoderCfg := zap.NewProductionEncoderConfig()
	encoderCfg.TimeKey = "timestamp"
	encoderCfg.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderCfg.MessageKey = "message"
	encoderCfg.LevelKey = "level"
	encoderCfg.EncodeLevel = zapcore.LowercaseLevelEncoder

	cfg := zap.Config{
		Level:            zap.NewAtomicLevelAt(level),
		Development:      false,
		Encoding:         "json",
		EncoderConfig:    encoderCfg,
		OutputPaths:      []string{"stdout"},
		ErrorOutputPaths: []string{"stderr"},
	}

	base, err := cfg.Build()
	if err != nil {
		panic("logger init failed: " + err.Error())
	}

	L = base.With(zap.String("service", service))
}

// FromFiberCtx returns a child logger that includes the correlation_id stored in
// the Fiber context locals. Import this in handler files:
//
//	log := logger.FromFiberCtx(c).With(zap.String("operation", "my_op"))
func FromFiberCtx(c *fiber.Ctx) *zap.Logger {
	corrID, _ := c.Locals("correlation_id").(string)
	if corrID == "" {
		return L
	}
	return L.With(zap.String("correlation_id", corrID))
}

// With returns a child logger with extra fields added to the global logger.
func With(fields ...zap.Field) *zap.Logger {
	return L.With(fields...)
}

// Sync flushes any buffered log entries. Call this on shutdown.
func Sync() {
	if L != nil {
		_ = L.Sync()
	}
}
