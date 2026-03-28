package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	DatabaseURL               string
	RedisURL                  string
	MigrationsPath            string
	JWTSecret                 string
	JWTExpiry                 time.Duration
	ScriptServiceURL          string
	MinioEndpoint             string
	MinioAccessKey            string
	MinioSecretKey            string
	MinioPresign              bool
	MinioPresignExpirySeconds int
	STTServiceGRPC            string
	AnalyticsGRPC             string
	MinioPublicEndpoint	   string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		// Use REDIS_ADDR if REDIS_URL is not set for backward compatibility
		redisURL = os.Getenv("REDIS_ADDR")
		if redisURL == "" {
			redisURL = "redis:6379"
		}
	}

	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "./internal/infrastructure/database/migrations"
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_secret"
	}

	scriptURL := os.Getenv("SCRIPT_SERVICE_URL")
	if scriptURL == "" {
		scriptURL = "http://script-service:8083"
	}

	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		minioEndpoint = "minio:9000"
	}

	minioPublicEndpoint := os.Getenv("MINIO_PUBLIC_ENDPOINT")
	if minioPublicEndpoint == "" {
		minioPublicEndpoint = "157.230.92.4:9000"
	}

	sttGRPC := os.Getenv("STT_SERVICE_GRPC")
	if sttGRPC == "" {
		sttGRPC = "stt-service:50051"
	}

	analyticsGRPC := os.Getenv("ANALYTICS_SERVICE_GRPC")
	if analyticsGRPC == "" {
		analyticsGRPC = "ai-analytics:50052"
	}

	presignEnabled := false
	if v := os.Getenv("MINIO_PRESIGN_ENABLED"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			presignEnabled = b
		}
	}

	presignExpiry := 300
	if v := os.Getenv("MINIO_PRESIGN_EXPIRY_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			presignExpiry = n
		}
	}

	return &Config{
		DatabaseURL:               dbURL,
		RedisURL:                  redisURL,
		MigrationsPath:            migrationsPath,
		JWTSecret:                 secret,
		JWTExpiry:                 time.Hour * 24,
		ScriptServiceURL:          scriptURL,
		MinioEndpoint:             minioEndpoint,
		MinioAccessKey:            os.Getenv("MINIO_ACCESS_KEY"),
		MinioSecretKey:            os.Getenv("MINIO_SECRET_KEY"),
		MinioPresign:              presignEnabled,
		MinioPresignExpirySeconds: presignExpiry,
		STTServiceGRPC:            sttGRPC,
		AnalyticsGRPC:             analyticsGRPC,
		MinioPublicEndpoint:       minioPublicEndpoint,
	}
}
