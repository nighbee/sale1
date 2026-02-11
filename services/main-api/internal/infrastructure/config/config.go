package config

import (
	"os"
	"time"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	JWTExpiry   time.Duration
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=localhost port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_secret"
	}

	return &Config{
		DatabaseURL: dbURL,
		JWTSecret:   secret,
		JWTExpiry:   time.Hour * 24,
	}
}
