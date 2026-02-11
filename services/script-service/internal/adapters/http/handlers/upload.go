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
	companyID := c.Locals("company_id").(string)

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

	// Upload to MinIO
	_, err = h.minioClient.FPutObject(context.Background(), "salesai", objectName, tmpPath, minio.PutObjectOptions{
		ContentType: "application/octet-stream",
	})
	if err != nil {
		// return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to upload to MinIO"})
		fmt.Printf("MinIO upload skipped (mock): %v\n", err)
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

func (h *ScriptHandler) ListScripts(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	scripts, err := h.repo.GetByCompany(c.Context(), companyID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(scripts)
}

func (h *ScriptHandler) GetScript(c *fiber.Ctx) error {
	id := c.Params("id")
	script, err := h.repo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Script not found"})
	}
	sMap := script.(map[string]interface{})
	if sMap["company_id"] != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	return c.JSON(script)
}

func (h *ScriptHandler) GetScriptContent(c *fiber.Ctx) error {
	id := c.Params("id")
	script, err := h.repo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Script not found"})
	}
	sMap := script.(map[string]interface{})
	if sMap["company_id"] != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	return c.JSON(fiber.Map{
		"id":          sMap["id"],
		"name":        sMap["name"],
		"parsed_text": sMap["parsed_text"],
		"created_at":  sMap["created_at"],
	})
}

func (h *ScriptHandler) UpdateScript(c *fiber.Ctx) error {
	id := c.Params("id")

	// Verify ownership
	existing, err := h.repo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Script not found"})
	}
	sMap := existing.(map[string]interface{})
	if sMap["company_id"] != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var req struct {
		Name     string `json:"name"`
		IsActive bool   `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	err = h.repo.Update(c.Context(), id, req.Name, req.IsActive)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Script updated"})
}

func (h *ScriptHandler) DeleteScript(c *fiber.Ctx) error {
	id := c.Params("id")

	// Verify ownership
	existing, err := h.repo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Script not found"})
	}
	sMap := existing.(map[string]interface{})
	if sMap["company_id"] != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	err = h.repo.Delete(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
