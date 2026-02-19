package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	_ "github.com/lib/pq"

	"github.com/salesai/script-service/internal/adapters/http/handlers"
	"github.com/salesai/script-service/internal/adapters/repositories"
)

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
	scripts := api.Group("/scripts")
	scripts.Post("/", scriptHandler.Upload)
	scripts.Get("/:company_id", scriptHandler.List)
	scripts.Get("/:id/download", scriptHandler.Download)
	scripts.Delete("/:id", scriptHandler.Delete)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("Script Service starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
