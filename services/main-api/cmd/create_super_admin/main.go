package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid" // go get github.com/google/uuid
	_ "github.com/lib/pq"    // Postgres driver
	"golang.org/x/crypto/bcrypt"
)

func main() {
    // 1. Get database connection from env or use default
    dbURL := os.Getenv("DATABASE_URL")
    if dbURL == "" {
        dbURL = "host=localhost port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    }

    db, err := sql.Open("postgres", dbURL)
    if err != nil {
        log.Fatal("Failed to open database connection:", err)
    }
    defer db.Close()

    // 2. Verify connection (optional but recommended)
    if err = db.Ping(); err != nil {
        log.Fatal("Cannot reach database:", err)
    }

    // 3. Read user input
    var username string
    var email string
    var password string


    fmt.Print("Username: ")
    fmt.Scanln(&username)

    fmt.Print("Email: ")
    fmt.Scanln(&email)

    fmt.Print("Password: ")
    fmt.Scanln(&password)

	companyID := uuid.New().String()
    fmt.Println("Generated company UUID:", companyID)

	_, err = db.Exec(`
		INSERT INTO auth_schema.companies (id, name, created_at)
		VALUES ($1, 'SuperAdminCompany', NOW())
	`, companyID)

    // 4. Validate input (basic)
    if username == "" || email == "" || password == "" || companyID == "" {
        log.Fatal("All fields are required")
    }

    // 5. Hash the password with error handling
    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        log.Fatal("Failed to hash password:", err)
    }

    // 6. Generate a proper UUID for the user
    userID := uuid.New().String()


    // ...existing code...

    _, err = db.Exec(`
    INSERT INTO auth_schema.users
        (id, email, password_hash, role, company_id, manager_name, created_at)
    VALUES
        ($1, $2, $3, 'super_admin', $4, $5, NOW())
`, userID, email, string(hash), companyID, username)

    if err != nil {
        log.Fatal("Failed to insert super admin:", err)
    }

    fmt.Println("Super admin created successfully!")
}