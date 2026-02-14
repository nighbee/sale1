package handlers

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/salesai/script-service/internal/adapters/repositories"
)

type ScriptHandler struct {
	minioClient *minio.Client
	repo        *repositories.ScriptRepository
}

func NewScriptHandler(minioClient *minio.Client, repo *repositories.ScriptRepository) *ScriptHandler {
	return &ScriptHandler{
		minioClient: minioClient,
		repo:        repo,
	}
}

func (h *ScriptHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file uploaded"})
	}

	name := c.FormValue("name")
	companyID := c.FormValue("company_id") // In production, get from JWT

	scriptID := uuid.New().String()
	ext := filepath.Ext(file.Filename)
	objectName := fmt.Sprintf("scripts/%s/%s%s", companyID, scriptID, ext)

	// Save to temp
	tmpPath := filepath.Join("/tmp", scriptID+ext)
	if err := c.SaveFile(file, tmpPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save temp file"})
	}
	defer os.Remove(tmpPath)

	// Parse with Python
	var parser string
	if ext == ".docx" {
		parser = "./scripts/parse_docx.py"
	} else if ext == ".pdf" {
		parser = "./scripts/parse_pdf.py"
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file type"})
	}

	cmd := exec.Command("python3", parser, tmpPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse document", "details": string(out)})
	}
	parsedText := string(out)

	bucketName := "scripts"
	exists, err := h.minioClient.BucketExists(context.Background(), bucketName)
	if err != nil {
		fmt.Printf("MinIO bucket check failed: %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to access MinIO"})
	}
	if !exists {
		err = h.minioClient.MakeBucket(context.Background(), bucketName, minio.MakeBucketOptions{})
		if err != nil {
			fmt.Printf("MinIO bucket creation failed: %v\n", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create MinIO bucket"})
		}
	}// Upload to MinIO
	_, err = h.minioClient.FPutObject(context.Background(), "scripts", objectName, tmpPath, minio.PutObjectOptions{
		ContentType: "application/octet-stream",
	})
	if err != nil {
		fmt.Printf("MinIO upload failed: %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to upload to MinIO"})
	}

	// Save to DB
	err = h.repo.Create(context.Background(), scriptID, companyID, name, objectName, parsedText)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save to database"})
	}

	return c.JSON(fiber.Map{
		"message":   "Script uploaded and parsed successfully",
		"script_id": scriptID,
	})
}

func (h *ScriptHandler) List(c *fiber.Ctx) error {
	companyID := c.Params("company_id")
	scripts, err := h.repo.List(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(scripts)
}

func (h *ScriptHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.repo.Delete(c.Context(), id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
