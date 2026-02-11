package handlers

import (
	"strconv"
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
)

type CallHandler struct {
	listCallsUC *calls.ListCallsUseCase
	callRepo    ports.CallRepository
}

func NewCallHandler(listCallsUC *calls.ListCallsUseCase, callRepo ports.CallRepository) *CallHandler {
	return &CallHandler{
		listCallsUC: listCallsUC,
		callRepo:    callRepo,
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
	return c.JSON(call)
}
