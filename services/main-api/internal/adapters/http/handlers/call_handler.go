package handlers

import (
	"strconv"
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
)

type CallHandler struct {
	listCallsUC      *calls.ListCallsUseCase
	getCallDetailsUC *calls.GetCallDetailsUseCase
	callRepo         ports.CallRepository
}

func NewCallHandler(
	listCallsUC *calls.ListCallsUseCase,
	getCallDetailsUC *calls.GetCallDetailsUseCase,
	callRepo ports.CallRepository,
) *CallHandler {
	return &CallHandler{
		listCallsUC:      listCallsUC,
		getCallDetailsUC: getCallDetailsUC,
		callRepo:         callRepo,
	}
}

func (h *CallHandler) ListCalls(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	req := calls.ListCallsRequest{
		CompanyID: companyID,
		ManagerID: c.Query("manager_id"),
		Status:    c.Query("status"),
		Page:      page,
		Limit:     limit,
	}

	resp, err := h.listCallsUC.Execute(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(resp)
}

func (h *CallHandler) GetCall(c *fiber.Ctx) error {
	id := c.Params("id")
	call, err := h.callRepo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}
	if call.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	return c.JSON(call)
}

func (h *CallHandler) GetTranscript(c *fiber.Ctx) error {
	id := c.Params("id")
	// Verify call ownership
	call, err := h.callRepo.GetByID(c.Context(), id)
	if err != nil || call.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	transcript, err := h.getCallDetailsUC.GetTranscript(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transcript not found"})
	}
	return c.JSON(transcript)
}

func (h *CallHandler) GetAnalysis(c *fiber.Ctx) error {
	id := c.Params("id")
	// Verify call ownership
	call, err := h.callRepo.GetByID(c.Context(), id)
	if err != nil || call.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	analysis, err := h.getCallDetailsUC.GetAnalysis(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Analysis not found"})
	}
	return c.JSON(analysis)
}

func (h *CallHandler) GetAudio(c *fiber.Ctx) error {
	// For now, redirect to the call_link (mocking MinIO streaming)
	id := c.Params("id")
	call, err := h.callRepo.GetByID(c.Context(), id)
	if err != nil || call.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}
	return c.Redirect(call.CallLink)
}

func (h *CallHandler) ReprocessCall(c *fiber.Ctx) error {
	id := c.Params("id")
	// Verify call ownership
	call, err := h.callRepo.GetByID(c.Context(), id)
	if err != nil || call.CompanyID != c.Locals("company_id").(string) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	// In production, this would re-enqueue the job to Redis
	return c.JSON(fiber.Map{
		"call_id": id,
		"status":  "queued",
		"message": "Call re-queued for processing (mock)",
	})
}
