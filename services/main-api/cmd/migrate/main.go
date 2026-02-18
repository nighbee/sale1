package main

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
	"github.com/salesai/main-api/internal/infrastructure/database"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=localhost port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	migrationsDir := os.Getenv("MIGRATIONS_PATH")
	if migrationsDir == "" {
		// Default to relative path from cmd/migrate
		migrationsDir = "../../internal/infrastructure/database/migrations"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := database.RunMigrations(db, migrationsDir); err != nil {
		log.Fatal("Migration failed:", err)
	}
}
