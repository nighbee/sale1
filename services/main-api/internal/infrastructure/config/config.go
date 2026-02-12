package config

import (
	"os"
	"time"
)

type Config struct {
	DatabaseURL      string
	JWTSecret        string
	JWTExpiry        time.Duration
	ScriptServiceURL string
	MinioEndpoint    string
	MinioAccessKey   string
	MinioSecretKey   string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
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

	return &Config{
		DatabaseURL:      dbURL,
		JWTSecret:        secret,
		JWTExpiry:        time.Hour * 24,
		ScriptServiceURL: scriptURL,
		MinioEndpoint:    minioEndpoint,
		MinioAccessKey:   os.Getenv("MINIO_ACCESS_KEY"),
		MinioSecretKey:   os.Getenv("MINIO_SECRET_KEY"),
	}
}
