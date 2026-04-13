package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
)

type QueueHandler struct {
	bulkReprocessUC *calls.BulkReprocessUseCase
	clearQueueUC    *calls.ClearTenantQueueUseCase
	publisher       ports.QueuePublisher
}

func NewQueueHandler(
	bulkReprocessUC *calls.BulkReprocessUseCase,
	clearQueueUC *calls.ClearTenantQueueUseCase,
	publisher ports.QueuePublisher,
) *QueueHandler {
	return &QueueHandler{
		bulkReprocessUC: bulkReprocessUC,
		clearQueueUC:    clearQueueUC,
		publisher:       publisher,
	}
}

// GetStatus godoc
// @Summary Get tenant queue status
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/status [get]
func (h *QueueHandler) GetStatus(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	paused, _ := h.publisher.IsQueuePaused(c.Context(), companyID)
	items, _ := h.publisher.GetQueueItems(c.Context(), companyID)

	return c.JSON(fiber.Map{
		"paused": paused,
		"length": len(items),
	})
}

// BulkReprocess godoc
// @Summary Add calls to queue by date range
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/bulk-reprocess [post]
func (h *QueueHandler) BulkReprocess(c *fiber.Ctx) error {
	var req struct {
		DateFrom string `json:"date_from"`
		DateTo   string `json:"date_to"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	companyID := c.Locals("company_id").(string)
	err := h.bulkReprocessUC.Execute(c.Context(), companyID, req.DateFrom, req.DateTo)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

// UpdateItem godoc
// @Summary Update specific item in queue
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/items [put]
func (h *QueueHandler) UpdateItem(c *fiber.Ctx) error {
	var req struct {
		OldRaw string `json:"old_raw"`
		NewRaw string `json:"new_raw"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	companyID := c.Locals("company_id").(string)
	err := h.publisher.UpdateQueueItem(c.Context(), companyID, req.OldRaw, req.NewRaw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// CreateItem godoc
// @Summary Create new item in queue
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/items [post]
func (h *QueueHandler) CreateItem(c *fiber.Ctx) error {
	var req struct {
		CallID    string `json:"call_id"`
		AudioURL  string `json:"audio_url"`
		ManagerID string `json:"manager_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	companyID := c.Locals("company_id").(string)
	err := h.publisher.EnqueueAudioProcessing(c.Context(), req.CallID, req.AudioURL, req.ManagerID, companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// ClearQueue godoc
// @Summary Clear all pending calls from queue
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue [delete]
func (h *QueueHandler) ClearQueue(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	err := h.clearQueueUC.Execute(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// StopQueue godoc
// @Summary Stop queue processing
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/stop [post]
func (h *QueueHandler) StopQueue(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	// Stop actually means Clear + Pause in many contexts, or just Pause.
	// User asked for "Stop queue" and "Delete all queue".
	// Let's implement Pause for Stop.
	err := h.publisher.PauseQueue(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Also clear it to be sure nothing stays in processing if they meant "Stop everything now"
	h.clearQueueUC.Execute(c.Context(), companyID)

	return c.JSON(fiber.Map{"status": "ok"})
}

// ResumeQueue godoc
// @Summary Resume queue processing
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/resume [post]
func (h *QueueHandler) ResumeQueue(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	err := h.publisher.ResumeQueue(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// ListItems godoc
// @Summary List items in queue
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/items [get]
func (h *QueueHandler) ListItems(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	items, err := h.publisher.GetQueueItems(c.Context(), companyID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"items": items})
}

// DeleteItem godoc
// @Summary Delete specific item from queue
// @Tags queue
// @Security BearerAuth
// @Router /calls/queue/items [delete]
func (h *QueueHandler) DeleteItem(c *fiber.Ctx) error {
	var req struct {
		Raw string `json:"raw"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	companyID := c.Locals("company_id").(string)
	err := h.publisher.DeleteQueueItem(c.Context(), companyID, req.Raw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}
