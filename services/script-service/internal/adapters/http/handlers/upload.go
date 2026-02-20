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
	applogger "github.com/salesai/script-service/internal/infrastructure/logger"
	"go.uber.org/zap"
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
	log := applogger.L.With(zap.String("operation", "upload_script"))
	file, err := c.FormFile("file")
	if err != nil {
		log.Warn("no file in upload request", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file uploaded"})
	}

	name := c.FormValue("name")
	companyID := c.FormValue("company_id") // In production, get from JWT
	teamID := c.FormValue("team_id")
	log.Info("script upload started",
		zap.String("company_id", companyID),
		zap.String("name", name),
		zap.String("filename", file.Filename),
		zap.Int64("size", file.Size))

	var teamIDPtr *string
	if teamID != "" {
		teamIDPtr = &teamID
	}

	scriptID := uuid.New().String()
	ext := filepath.Ext(file.Filename)
	objectName := fmt.Sprintf("scripts/%s/%s%s", companyID, scriptID, ext)

	// Save to temp
	tmpPath := filepath.Join("/tmp", scriptID+ext)
	if err := c.SaveFile(file, tmpPath); err != nil {
		log.Error("failed to save temp file", zap.String("tmp_path", tmpPath), zap.Error(err))
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
		log.Warn("unsupported file type", zap.String("ext", ext))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file type"})
	}

	log.Debug("parsing document", zap.String("parser", parser), zap.String("ext", ext))
	cmd := exec.Command("python3", parser, tmpPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Error("document parse failed", zap.String("parser", parser), zap.Error(err), zap.String("output", string(out)))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse document", "details": string(out)})
	}
	parsedText := string(out)
	log.Info("document parsed successfully", zap.String("script_id", scriptID), zap.Int("text_len", len(parsedText)))

	bucketName := "scripts"
	exists, err := h.minioClient.BucketExists(context.Background(), bucketName)
	if err != nil {
		log.Error("MinIO bucket check failed", zap.String("bucket", bucketName), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to access MinIO"})
	}
	if !exists {
		err = h.minioClient.MakeBucket(context.Background(), bucketName, minio.MakeBucketOptions{})
		if err != nil {
			log.Error("MinIO bucket creation failed", zap.String("bucket", bucketName), zap.Error(err))
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create MinIO bucket"})
		}
		log.Info("MinIO bucket created", zap.String("bucket", bucketName))
	}
	// Upload to MinIO
	_, err = h.minioClient.FPutObject(context.Background(), "scripts", objectName, tmpPath, minio.PutObjectOptions{
		ContentType: "application/octet-stream",
	})
	if err != nil {
		log.Error("MinIO upload failed", zap.String("object", objectName), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to upload to MinIO"})
	}
	log.Info("file uploaded to MinIO", zap.String("object", objectName))

	// Save to DB
	err = h.repo.Create(context.Background(), scriptID, companyID, name, objectName, parsedText, teamIDPtr)
	if err != nil {
		log.Error("database save failed", zap.String("script_id", scriptID), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save to database"})
	}

	log.Info("script upload completed", zap.String("script_id", scriptID), zap.String("company_id", companyID))
	return c.JSON(fiber.Map{
		"message":   "Script uploaded and parsed successfully",
		"script_id": scriptID,
	})
}

func (h *ScriptHandler) List(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "list_scripts"))
	companyID := c.Params("company_id")
	scripts, err := h.repo.List(c.Context(), companyID)
	if err != nil {
		log.Error("list scripts failed", zap.String("company_id", companyID), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Debug("scripts listed", zap.String("company_id", companyID), zap.Int("count", len(scripts)))
	return c.JSON(scripts)
}

func (h *ScriptHandler) Delete(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "delete_script"))
	id := c.Params("id")
	if err := h.repo.Delete(c.Context(), id); err != nil {
		log.Error("delete script failed", zap.String("script_id", id), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	log.Info("script deleted", zap.String("script_id", id))
	return c.SendStatus(204)
}

func (h *ScriptHandler) Download(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "download_script"))
	id := c.Params("id")
	script, err := h.repo.GetByID(c.Context(), id)
	if err != nil {
		log.Warn("script not found", zap.String("script_id", id), zap.Error(err))
		return c.Status(404).JSON(fiber.Map{"error": "Script not found"})
	}

	objectPath, _ := script["file_path_minio"].(string)
	log.Info("downloading script from MinIO", zap.String("script_id", id), zap.String("object", objectPath))
	object, err := h.minioClient.GetObject(c.Context(), "scripts", objectPath, minio.GetObjectOptions{})
	if err != nil {
		log.Error("MinIO get object failed", zap.String("object", objectPath), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get object from MinIO"})
	}

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", script["name"].(string)))
	return c.SendStream(object)
}
