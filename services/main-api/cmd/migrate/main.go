package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"

	_ "github.com/lib/pq"
)

type Migration struct {
	Version  int
	Filename string
	Content  string
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=localhost port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Create migrations table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT PRIMARY KEY,
			filename VARCHAR(255) NOT NULL,
			executed_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create migrations table:", err)
	}

	// Load migration files
	migrationsDir := "./internal/infrastructure/database/migrations"
	migrations, err := loadMigrations(migrationsDir)
	if err != nil {
		log.Fatal("Failed to load migrations:", err)
	}

	// Run pending migrations
	for _, migration := range migrations {
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", migration.Version).Scan(&exists)
		if err != nil {
			log.Fatal(err)
		}

		if !exists {
			log.Printf("Running migration %s...", migration.Filename)
			_, err := db.Exec(migration.Content)
			if err != nil {
				log.Fatalf("Migration %s failed: %v", migration.Filename, err)
			}

			_, err = db.Exec("INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)", migration.Version, migration.Filename)
			if err != nil {
				log.Fatal(err)
			}
			log.Printf("✓ Migration %s completed", migration.Filename)
		}
	}

	log.Println("All migrations completed successfully!")
}

func loadMigrations(dir string) ([]Migration, error) {
	var migrations []Migration
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	for _, file := range files {
		if filepath.Ext(file.Name()) != ".sql" {
			continue
		}
		content, err := ioutil.ReadFile(filepath.Join(dir, file.Name()))
		if err != nil {
			return nil, err
		}
		var version int
		fmt.Sscanf(file.Name(), "%d_", &version)
		migrations = append(migrations, Migration{
			Version:  version,
			Filename: file.Name(),
			Content:  string(content),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})
	return migrations, nil
}
