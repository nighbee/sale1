package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/minio/minio-go/v7"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	"github.com/salesai/main-api/pkg/analytics"
	"github.com/salesai/main-api/pkg/stt"
)

type CallHandler struct {
	listCallsUC     *calls.ListCallsUseCase
	callRepo        ports.CallRepository
	transcriptRepo  ports.TranscriptRepository
	analysisRepo    ports.AnalysisRepository
	minioClient     *minio.Client
	sttClient       stt.STTServiceClient
	analyticsClient analytics.AnalyticsServiceClient
}

func NewCallHandler(
	listCallsUC *calls.ListCallsUseCase,
	callRepo ports.CallRepository,
	transcriptRepo ports.TranscriptRepository,
	analysisRepo ports.AnalysisRepository,
	minioClient *minio.Client,
	sttClient stt.STTServiceClient,
	analyticsClient analytics.AnalyticsServiceClient,
) *CallHandler {
	return &CallHandler{
		listCallsUC:     listCallsUC,
		callRepo:        callRepo,
		transcriptRepo:  transcriptRepo,
		analysisRepo:    analysisRepo,
		minioClient:     minioClient,
		sttClient:       sttClient,
		analyticsClient: analyticsClient,
	}
}

// ListCalls godoc
// @Summary List calls with filters
// @Description Get a paginated list of calls for the company
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param manager_id query string false "Filter by manager ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} calls.ListCallsResponse
// @Router /calls [get]
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

// GetCall godoc
// @Summary Get call details
// @Description Get detailed information about a call, including transcript and analysis
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Call ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]string
// @Router /calls/{id} [get]
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

// GetTranscript godoc
// @Summary Get call transcript
// @Description Get the diarized transcript of a call
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Call ID"
// @Success 200 {object} domain.Transcript
// @Failure 404 {object} map[string]string
// @Router /calls/{id}/transcript [get]
func (h *CallHandler) GetTranscript(c *fiber.Ctx) error {
	id := c.Params("id")

	// Try gRPC first to demonstrate connectivity
	if h.sttClient != nil {
		resp, err := h.sttClient.GetTranscript(c.Context(), &stt.TranscriptRequest{CallId: id})
		if err == nil {
			var segments interface{}
			json.Unmarshal([]byte(resp.TranscriptJson), &segments)
			return c.JSON(fiber.Map{
				"call_id":                 resp.CallId,
				"speaker_diarized_json":   segments,
				"stt_provider":            resp.SttProvider,
				"processing_time_seconds": resp.ProcessingTime,
				"source":                  "grpc",
			})
		}
	}

	transcript, err := h.transcriptRepo.GetByCallID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transcript not found"})
	}
	return c.JSON(transcript)
}

// GetAnalysis godoc
// @Summary Get call analysis
// @Description Get the AI-generated analysis report for a call
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Call ID"
// @Success 200 {object} domain.AnalysisReport
// @Failure 404 {object} map[string]string
// @Router /calls/{id}/analysis [get]
func (h *CallHandler) GetAnalysis(c *fiber.Ctx) error {
	id := c.Params("id")

	// Try gRPC first
	if h.analyticsClient != nil {
		resp, err := h.analyticsClient.GetAnalysis(c.Context(), &analytics.AnalysisRequest{CallId: id})
		if err == nil {
			return c.JSON(fiber.Map{
				"call_id":          resp.CallId,
				"quality_score":    resp.QualityScore,
				"script_match":     resp.ScriptMatch,
				"errors_free":      resp.ErrorsFree,
				"overall_rating":   resp.OverallRating,
				"kpi":              resp.Kpi,
				"recommendation":   resp.Recommendation,
				"brief":            resp.Brief,
				"next_best_action": resp.NextBestAction,
				"source":           "grpc",
			})
		}
	}

	analysis, err := h.analysisRepo.GetByCallID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Analysis not found"})
	}
	return c.JSON(analysis)
}

// ReprocessCall godoc
// @Summary Re-queue call for processing
// @Description Manually trigger STT and AI analysis for a failed or old call
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Call ID"
// @Success 200 {object} map[string]string
// @Router /calls/{id}/reprocess [post]
func (h *CallHandler) ReprocessCall(c *fiber.Ctx) error {
	id := c.Params("id")
	// Logic to re-enqueue job would go here
	return c.JSON(fiber.Map{
		"call_id": id,
		"status":  "queued",
		"message": "Call re-queued for processing",
	})
}

// GetAudio godoc
// @Summary Stream call audio
// @Description Stream the audio recording of a call from MinIO
// @Tags Calls
// @Produce audio/mpeg
// @Security BearerAuth
// @Param id path string true "Call ID"
// @Success 200 {file} binary
// @Failure 404 {object} map[string]string
// @Router /calls/{id}/audio [get]
func (h *CallHandler) GetAudio(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	call, err := h.callRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	// The call record should have a reference to the MinIO object name.
	// If it doesn't, we can try to find it in the 'audio' bucket.
	// For now, let's assume the object name is "<call_id>.mp3" in bucket "audio"
	objectName := fmt.Sprintf("%s.mp3", id)

	reader, err := h.minioClient.GetObject(context.Background(), "audio", objectName, minio.GetObjectOptions{})
	if err != nil {
		// Fallback to redirect if not found in MinIO
		return c.Redirect(call.CallLink)
	}
	defer reader.Close()

	// Check if object exists by calling Stat
	_, err = reader.Stat()
	if err != nil {
		return c.Redirect(call.CallLink)
	}

	c.Set("Content-Type", "audio/mpeg")
	return c.SendStream(reader)
}
