package handlers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
)

type ScriptHandler struct {
	scriptRepo       ports.ScriptRepository
	scriptServiceURL string
}

func NewScriptHandler(scriptRepo ports.ScriptRepository, scriptServiceURL string) *ScriptHandler {
	return &ScriptHandler{
		scriptRepo:       scriptRepo,
		scriptServiceURL: scriptServiceURL,
	}
}

func (h *ScriptHandler) ListScripts(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	scripts, err := h.scriptRepo.ListByCompany(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"scripts": scripts})
}

func (h *ScriptHandler) GetScript(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	script, err := h.scriptRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Script not found"})
	}
	return c.JSON(script)
}

func (h *ScriptHandler) GetScriptContent(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	script, err := h.scriptRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Script not found"})
	}
	return c.JSON(fiber.Map{
		"id":          script.ID,
		"name":        script.Name,
		"parsed_text": script.ParsedText,
		"created_at":  script.CreatedAt,
	})
}

func (h *ScriptHandler) CreateScript(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "File is required"})
	}

	name := c.FormValue("name")
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	// Proxy to script-service
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", file.Filename)
	f, _ := file.Open()
	io.Copy(part, f)
	writer.WriteField("name", name)
	writer.WriteField("company_id", companyID)
	writer.Close()

	req, _ := http.NewRequest("POST", h.scriptServiceURL+"/api/v1/scripts", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Script service error: %v", err)})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return c.Status(resp.StatusCode).Send(respBody)
	}

	io.Copy(io.Discard, resp.Body) // We don't really need the body here if we just want to return success

	return c.Status(201).JSON(fiber.Map{
		"message": "Script uploaded and parsed successfully via script-service",
	})
}

func (h *ScriptHandler) UpdateScript(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	script, err := h.scriptRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Script not found"})
	}

	var update struct {
		Name     string `json:"name"`
		IsActive bool   `json:"is_active"`
	}

	if err := c.BodyParser(&update); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid body"})
	}

	script.Name = update.Name
	script.IsActive = update.IsActive

	if err := h.scriptRepo.Update(c.Context(), script); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(script)
}

func (h *ScriptHandler) DeleteScript(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	if err := h.scriptRepo.Delete(c.Context(), companyID, id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
