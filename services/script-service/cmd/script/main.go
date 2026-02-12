package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	_ "github.com/salesai/script-service/docs"
	"github.com/gofiber/swagger"

	"github.com/salesai/script-service/internal/adapters/http/handlers"
	"github.com/salesai/script-service/internal/adapters/repositories"
)

// @title SalesAI Script Management Service
// @version 1.0
// @description Microservice for sales scripts handling and text extraction

// @contact.name API Support
// @contact.email support@salesai.com

// @host localhost:8083
// @BasePath /api/v1

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		endpoint = "minio:9000"
	}
	accessKeyID := os.Getenv("MINIO_ACCESS_KEY")
	secretAccessKey := os.Getenv("MINIO_SECRET_KEY")
	useSSL := false

	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Fatalln(err)
	}

	repo := repositories.NewScriptRepository(db)
	scriptHandler := handlers.NewScriptHandler(minioClient, repo)

	app := fiber.New()
	app.Use(logger.New())

	api := app.Group("/api/v1")

	// Swagger
	api.Get("/docs/*", swagger.HandlerDefault)

	scripts := api.Group("/scripts")
	scripts.Post("/", scriptHandler.Upload)
	scripts.Get("/:company_id", scriptHandler.List)
	scripts.Delete("/:id", scriptHandler.Delete)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("Script Service starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
