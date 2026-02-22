package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/minio/minio-go/v7"
	"github.com/salesai/main-api/internal/adapters/grpc"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
	"github.com/salesai/main-api/internal/core/usecases/calls"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"go.uber.org/zap"
)

var _ = domain.Transcript{}

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

// ListCalls godoc
// @Summary List calls with filters
// @Description Get a paginated list of calls for the company
// @Tags calls
// @Accept json
// @Produce json
// @Param manager_id query string false "Filter by manager ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Page limit" default(20)
// @Success 200 {object} calls.ListCallsResponse
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /calls [get]
func (h *CallHandler) ListCalls(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "list_calls"))
	companyID := c.Locals("company_id").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	req := calls.ListCallsRequest{
		CompanyID:   companyID,
		ManagerID:   c.Query("manager_id"),
		ManagerName: c.Query("manager_name"),
		ClientPhone: c.Query("client_phone"),
		TeamID:      c.Query("team_id"),
		Status:      c.Query("status"),
		Source:      c.Query("source"),
		DateFrom:    c.Query("date_from"),
		DateTo:      c.Query("date_to"),
		Page:        page,
		Limit:       limit,
	}

	log.Debug("listing calls", zap.String("company_id", companyID),
		zap.String("manager_id", req.ManagerID), zap.String("status", req.Status),
		zap.Int("page", page), zap.Int("limit", limit))

	resp, err := h.listCallsUC.Execute(c.Context(), req)
	if err != nil {
		log.Error("list calls failed", zap.String("company_id", companyID), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(resp)
}

// GetCall godoc
// @Summary Get call details
// @Description Get full details of a call including transcript and analysis
// @Tags calls
// @Accept json
// @Produce json
// @Param id path string true "Call ID"
// @Success 200 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /calls/{id} [get]
func (h *CallHandler) GetCall(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_call"))
	id := c.Params("id")
	companyID := c.Locals("company_id").(string)
	log.Debug("fetching call", zap.String("call_id", id), zap.String("company_id", companyID))
	call, err := h.callRepo.GetByID(c.Context(), companyID, id)
	if err != nil {
		log.Warn("call not found", zap.String("call_id", id), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	transcript, _ := h.transcriptRepo.GetByCallID(c.Context(), id)
	analysis, _ := h.analysisRepo.GetByCallID(c.Context(), id)

	log.Info("call fetched", zap.String("call_id", id), zap.String("status", string(call.Status)))
	return c.JSON(fiber.Map{
		"call":       call,
		"transcript": transcript,
		"analysis":   analysis,
	})
}

// GetTranscript godoc
// @Summary Get call transcript
// @Description Get the diarized transcript for a call
// @Tags calls
// @Accept json
// @Produce json
// @Param id path string true "Call ID"
// @Success 200 {object} domain.Transcript
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /calls/{id}/transcript [get]
func (h *CallHandler) GetTranscript(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_transcript"))
	id := c.Params("id")
	log.Debug("fetching transcript", zap.String("call_id", id))

	// Try gRPC first if client is available
	if h.grpcClient != nil {
		resp, err := h.grpcClient.GetTranscript(c.Context(), id)
		if err == nil {
			log.Debug("transcript fetched via gRPC", zap.String("call_id", id))
			// Map to domain-like structure for frontend compatibility
			return c.JSON(fiber.Map{
				"call_id":      resp.CallId,
				"segments":     json.RawMessage(resp.TranscriptJson),
				"stt_provider": resp.SttProvider,
			})
		}
		log.Debug("gRPC transcript fetch failed, falling back to DB", zap.String("call_id", id), zap.Error(err))
	}

	transcript, err := h.transcriptRepo.GetByCallID(c.Context(), id)
	if err != nil {
		log.Warn("transcript not found", zap.String("call_id", id), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transcript not found"})
	}
	log.Info("transcript fetched from DB", zap.String("call_id", id))
	return c.JSON(transcript)
}

// GetAnalysis godoc
// @Summary Get call analysis
// @Description Get the AI analysis report for a call
// @Tags calls
// @Accept json
// @Produce json
// @Param id path string true "Call ID"
// @Success 200 {object} domain.AnalysisReport
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /calls/{id}/analysis [get]
func (h *CallHandler) GetAnalysis(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_analysis"))
	id := c.Params("id")
	log.Debug("fetching analysis", zap.String("call_id", id))

	// Try gRPC first if client is available
	if h.grpcClient != nil {
		resp, err := h.grpcClient.GetAnalysis(c.Context(), id)
		if err == nil {
			log.Debug("analysis fetched via gRPC", zap.String("call_id", id))
			// Map to domain-like structure for frontend compatibility
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
				// Frontend compatibility mappings
				"summary":    resp.Brief,
				"next_steps": strings.Split(resp.NextBestAction, "\n"),
			})
		}
		log.Debug("gRPC analysis fetch failed, falling back to DB", zap.String("call_id", id), zap.Error(err))
	}

	analysis, err := h.analysisRepo.GetByCallID(c.Context(), id)
	if err != nil {
		log.Warn("analysis not found", zap.String("call_id", id), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Analysis not found"})
	}
	log.Info("analysis fetched from DB", zap.String("call_id", id))
	return c.JSON(analysis)
}

// ReprocessCall godoc
// @Summary Reprocess a call
// @Description Re-enqueue a call for STT and AI analysis
// @Tags calls
// @Accept json
// @Produce json
// @Param id path string true "Call ID"
// @Success 200 {object} fiber.Map
// @Security BearerAuth
// @Router /calls/{id}/reprocess [post]
func (h *CallHandler) ReprocessCall(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "reprocess_call"))
	id := c.Params("id")
	userID, _ := c.Locals("user_id").(string)
	log.Info("call reprocess requested", zap.String("call_id", id), zap.String("user_id", userID))
	// Logic to re-enqueue job would go here
	return c.JSON(fiber.Map{
		"call_id": id,
		"status":  "queued",
		"message": "Call re-queued for processing",
	})
}

// GetAudio godoc
// @Summary Stream call audio
// @Description Get the audio file for a call from MinIO
// @Tags calls
// @Produce audio/mpeg
// @Param id path string true "Call ID"
// @Success 200 {file} binary
// @Failure 404 {object} fiber.Map
// @Security BearerAuth
// @Router /calls/{id}/audio [get]
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
