package database

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
	"sort"
	"time"

	_ "github.com/lib/pq"
)

type Migration struct {
	Version  int
	Filename string
	Content  string
}

func RunMigrations(db *sql.DB, migrationsDir string) error {
	log.Printf("Starting migrations from directory: %s", migrationsDir)

	// Retry logic for database connection
	var err error
	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		// Create migrations table (this will also test the connection)
		_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				version INT PRIMARY KEY,
				filename VARCHAR(255) NOT NULL,
				executed_at TIMESTAMP DEFAULT NOW()
			)
		`)
		if err == nil {
			break
		}
		log.Printf("[MIGRATE] Database not ready, retrying in 2s... (%d/%d)", i+1, maxRetries)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return fmt.Errorf("failed to connect to database or create migrations table after retries: %w", err)
	}

	// Load migration files
	migrations, err := loadMigrations(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to load migrations: %w", err)
	}

	// Run pending migrations
	for _, migration := range migrations {
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", migration.Version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("error checking migration %s: %w", migration.Filename, err)
		}

		if !exists {
			log.Printf("[MIGRATE] Running migration %s...", migration.Filename)
			_, err := db.Exec(migration.Content)
			if err != nil {
				return fmt.Errorf("migration %s failed: %w", migration.Filename, err)
			}

			_, err = db.Exec("INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)", migration.Version, migration.Filename)
			if err != nil {
				return fmt.Errorf("failed to record migration %s: %w", migration.Filename, err)
			}
			log.Printf("[MIGRATE] ✓ Success: %s", migration.Filename)
		} else {
			log.Printf("[MIGRATE] Skip: %s (already executed)", migration.Filename)
		}
	}

	log.Println("[MIGRATE] Database is up to date.")
	return nil
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
		path := filepath.Join(dir, file.Name())
		content, err := ioutil.ReadFile(path)
		if err != nil {
			return nil, err
		}
		var version int
		_, err = fmt.Sscanf(file.Name(), "%d_", &version)
		if err != nil {
			log.Printf("Warning: skipping migration file %s due to invalid format", file.Name())
			continue
		}
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
