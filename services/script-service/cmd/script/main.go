package main

import (
	"database/sql"
	"os"

	"github.com/gofiber/fiber/v2"
	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"

	"github.com/salesai/script-service/internal/adapters/http/handlers"
	"github.com/salesai/script-service/internal/adapters/repositories"
	applogger "github.com/salesai/script-service/internal/infrastructure/logger"
)

func main() {
	applogger.Init("script-service")
	defer applogger.Sync()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		applogger.L.Fatal("failed to open database connection", zap.Error(err))
	}
	defer db.Close()
	applogger.L.Info("database connection established")

	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		endpoint = "minio:9000"
	}
	accessKeyID := os.Getenv("MINIO_ACCESS_KEY")
	secretAccessKey := os.Getenv("MINIO_SECRET_KEY")

	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: false,
	})
	if err != nil {
		applogger.L.Fatal("failed to create MinIO client", zap.String("endpoint", endpoint), zap.Error(err))
	}
	applogger.L.Info("MinIO client created", zap.String("endpoint", endpoint))

	repo := repositories.NewScriptRepository(db)
	scriptHandler := handlers.NewScriptHandler(minioClient, repo)

	app := fiber.New()

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

	applogger.L.Info("script-service starting", zap.String("port", port))
	if err := app.Listen(":" + port); err != nil {
		applogger.L.Fatal("server exited with error", zap.Error(err))
	}
}
