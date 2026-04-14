package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/script-service/internal/core/usecases"
	applogger "github.com/salesai/script-service/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type ScriptHandler struct {
	uploadUC    *usecases.UploadScriptUseCase
	operationsUC *usecases.ScriptOperationsUseCase
}

func NewScriptHandler(uploadUC *usecases.UploadScriptUseCase, operationsUC *usecases.ScriptOperationsUseCase) *ScriptHandler {
	return &ScriptHandler{
		uploadUC:    uploadUC,
		operationsUC: operationsUC,
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
	companyID := c.FormValue("company_id")
	teamID := c.FormValue("team_id")

	ext := filepath.Ext(file.Filename)
	tmpPath := filepath.Join("/tmp", fmt.Sprintf("upload-%d%s", time.Now().UnixNano(), ext))
	if err := c.SaveFile(file, tmpPath); err != nil {
		log.Error("failed to save temp file", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save temp file"})
	}
	defer os.Remove(tmpPath)

	var teamIDPtr *string
	if teamID != "" {
		teamIDPtr = &teamID
	}

	req := usecases.UploadScriptRequest{
		Name:      name,
		CompanyID: companyID,
		TeamID:    teamIDPtr,
		FilePath:  tmpPath,
		Extension: ext,
	}

	scriptID, err := h.uploadUC.Execute(c.Context(), req)
	if err != nil {
		log.Error("upload usecase failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":   "Script uploaded and parsed successfully",
		"script_id": scriptID,
	})
}

func (h *ScriptHandler) List(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "list_scripts"))
	companyID := c.Get("X-Company-ID")
	scripts, err := h.operationsUC.ListScripts(c.Context(), companyID)
	if err != nil {
		log.Error("list scripts failed", zap.String("company_id", companyID), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(scripts)
}

func (h *ScriptHandler) Delete(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "delete_script"))
	id := c.Params("id")
	companyID := c.Get("X-Company-ID")
	if err := h.operationsUC.DeleteScript(c.Context(), id, companyID); err != nil {
		log.Error("delete script failed", zap.String("script_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *ScriptHandler) Download(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "download_script"))
	id := c.Params("id")
	companyID := c.Get("X-Company-ID")
	stream, name, err := h.operationsUC.DownloadScript(c.Context(), id, companyID)
	if err != nil {
		log.Warn("download script failed", zap.String("script_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(404).JSON(fiber.Map{"error": "Script not found"})
	}

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", name))
	return c.SendStream(stream)
}

func (h *ScriptHandler) GetDetails(c *fiber.Ctx) error {
	log := applogger.L.With(zap.String("operation", "get_script_details"))
	id := c.Params("id")
	companyID := c.Get("X-Company-ID")
	script, err := h.operationsUC.GetScriptDetails(c.Context(), id, companyID)
	if err != nil {
		log.Warn("get script details failed", zap.String("script_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(404).JSON(fiber.Map{"error": "Script not found"})
	}
	return c.JSON(script)
}
