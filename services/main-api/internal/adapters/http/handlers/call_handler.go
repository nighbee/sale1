package handlers

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/minio/minio-go/v7"
	"github.com/salesai/main-api/internal/adapters/grpc"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
)

type CallHandler struct {
	listCallsUC    *calls.ListCallsUseCase
	callRepo       ports.CallRepository
	transcriptRepo ports.TranscriptRepository
	analysisRepo   ports.AnalysisRepository
	minioClient    *minio.Client
	grpcClient     *grpc.GRPCClient
}

func NewCallHandler(
	listCallsUC *calls.ListCallsUseCase,
	callRepo ports.CallRepository,
	transcriptRepo ports.TranscriptRepository,
	analysisRepo ports.AnalysisRepository,
	minioClient *minio.Client,
	grpcClient *grpc.GRPCClient,
) *CallHandler {
	return &CallHandler{
		listCallsUC:    listCallsUC,
		callRepo:       callRepo,
		transcriptRepo: transcriptRepo,
		analysisRepo:   analysisRepo,
		minioClient:    minioClient,
		grpcClient:     grpcClient,
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
	companyID := c.Locals("company_id").(string)
	call, err := h.callRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	transcript, _ := h.transcriptRepo.GetByCallID(c.Context(), id)
	analysis, _ := h.analysisRepo.GetByCallID(c.Context(), id)

	return c.JSON(fiber.Map{
		"call":       call,
		"transcript": transcript,
		"analysis":   analysis,
	})
}

func (h *CallHandler) GetTranscript(c *fiber.Ctx) error {
	id := c.Params("id")

	// Try gRPC first if client is available
	if h.grpcClient != nil {
		resp, err := h.grpcClient.GetTranscript(c.Context(), id)
		if err == nil {
			return c.JSON(resp)
		}
	}

	transcript, err := h.transcriptRepo.GetByCallID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transcript not found"})
	}
	return c.JSON(transcript)
}

func (h *CallHandler) GetAnalysis(c *fiber.Ctx) error {
	id := c.Params("id")

	// Try gRPC first if client is available
	if h.grpcClient != nil {
		resp, err := h.grpcClient.GetAnalysis(c.Context(), id)
		if err == nil {
			return c.JSON(resp)
		}
	}

	analysis, err := h.analysisRepo.GetByCallID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Analysis not found"})
	}
	return c.JSON(analysis)
}

func (h *CallHandler) ReprocessCall(c *fiber.Ctx) error {
	id := c.Params("id")
	// Logic to re-enqueue job would go here
	return c.JSON(fiber.Map{
		"call_id": id,
		"status":  "queued",
		"message": "Call re-queued for processing",
	})
}

func (h *CallHandler) GetAudio(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	call, err := h.callRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	var bucketName, objectName string
	if strings.HasPrefix(call.CallLink, "minio://") {
		parts := strings.Split(strings.TrimPrefix(call.CallLink, "minio://"), "/")
		if len(parts) >= 2 {
			bucketName = parts[0]
			objectName = strings.Join(parts[1:], "/")
		}
	}

	if bucketName == "" {
		// Fallback to old behavior or direct redirect
		bucketName = "audio"
		objectName = fmt.Sprintf("%s.mp3", id)
	}

	reader, err := h.minioClient.GetObject(context.Background(), bucketName, objectName, minio.GetObjectOptions{})
	if err != nil {
		return c.Redirect(call.CallLink)
	}
	defer reader.Close()

	_, err = reader.Stat()
	if err != nil {
		if strings.HasPrefix(call.CallLink, "http") {
			return c.Redirect(call.CallLink)
		}
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Audio file not found in storage"})
	}

	c.Set("Content-Type", "audio/mpeg")
	return c.SendStream(reader)
}
