package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	neturl "net/url"
	"strconv"
	"strings"
	"time"

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
	listCallsUC     *calls.ListCallsUseCase
	reprocessCallUC *calls.ReprocessCallUseCase
	callRepo        ports.CallRepository
	transcriptRepo  ports.TranscriptRepository
	analysisRepo      ports.AnalysisRepository
	minioClient       *minio.Client
	publicMinioClient *minio.Client
	grpcClient        *grpc.GRPCClient
	presignEnabled    bool
	presignExpiry   time.Duration
}

func NewCallHandler(
	listCallsUC *calls.ListCallsUseCase,
	reprocessCallUC *calls.ReprocessCallUseCase,
	callRepo ports.CallRepository,
	transcriptRepo ports.TranscriptRepository,
	analysisRepo ports.AnalysisRepository,
	minioClient *minio.Client,
	publicMinioClient *minio.Client,
	grpcClient *grpc.GRPCClient,
	presignEnabled bool,
	presignExpiry time.Duration,
) *CallHandler {
	return &CallHandler{
		listCallsUC:       listCallsUC,
		reprocessCallUC:   reprocessCallUC,
		callRepo:          callRepo,
		transcriptRepo:    transcriptRepo,
		analysisRepo:      analysisRepo,
		minioClient:       minioClient,
		publicMinioClient: publicMinioClient,
		grpcClient:        grpcClient,
		presignEnabled:    presignEnabled,
		presignExpiry:     presignExpiry,
	}
}

// ListCalls godoc
// @Summary List calls with filters
// @Description Get a paginated list of calls
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

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	req := calls.ListCallsRequest{
		CompanyID:   companyID,
		ManagerID:   c.Query("manager_id"),
		ManagerName: c.Query("manager_name"),
		ClientPhone: c.Query("client_phone"),
		TeamID:      c.Query("team_id"),
		Status:      c.Query("status"),
		Source:      c.Query("source"),
		Search:      c.Query("search"),
		DateFrom:    c.Query("date_from"),
		DateTo:      c.Query("date_to"),
		Page:        page,
		Limit:       limit,
	}

	// Enforce permission rules:
	// - Super admins and tenant admins may list calls and provide manager_id to filter.
	// - Other authenticated users may only view calls for which they are the manager (manager_id == requester_id).
	requesterID, _ := c.Locals("user_id").(string)
	requesterRole, _ := c.Locals("role").(string)
	if requesterRole != string(domain.RoleSuperAdmin) && requesterRole != string(domain.RoleTenantAdmin) {
		// Ignore any provided manager_id and restrict to requester
		req.ManagerID = requesterID
	}

	log.Debug("listing calls",
		zap.String("manager_id", req.ManagerID), zap.String("status", req.Status),
		zap.Int("page", page), zap.Int("limit", limit))

	resp, err := h.listCallsUC.Execute(c.Context(), req)
	if err != nil {
		log.Error("list calls failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(resp)
}

// ListAllCalls godoc
// @Summary List all calls (Admin)
// @Description List all calls in the system with optional filters.
// @Tags admin
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Page limit" default(20)
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /admin/calls [get]
func (h *CallHandler) ListAllCalls(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	filters := map[string]interface{}{
		"page":  page,
		"limit": limit,
	}

	if companyID := c.Query("company_id"); companyID != "" {
		filters["company_id"] = companyID
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}

	calls, total, err := h.callRepo.ListAll(c.Context(), filters)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"calls": calls,
		"total": total,
	})
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

	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	log.Debug("fetching call", zap.String("call_id", id))
	call, err := h.callRepo.GetByID(c.Context(), id, companyID)
	if err != nil {
		log.Warn("call not found or unauthorized access", zap.String("call_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	transcript, _ := h.transcriptRepo.GetByCallID(c.Context(), call.ID)
	if transcript != nil {
		transcript.Transcript = h.formatTranscript(transcript.SpeakerDiarizedJSON)
	}
	analysis, _ := h.analysisRepo.GetByCallID(c.Context(), call.ID)

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

	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	log.Debug("fetching transcript", zap.String("call_id", id))

	// Resolve the internal UUID first
	call, err := h.callRepo.GetByID(c.Context(), id, companyID)
	if err != nil {
		log.Warn("call not found or unauthorized access for transcript", zap.String("call_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}
	internalID := call.ID

	// Try gRPC first if client is available
	if h.grpcClient != nil {
		resp, err := h.grpcClient.GetTranscript(c.Context(), internalID)
		if err == nil {
			log.Debug("transcript fetched via gRPC", zap.String("call_id", id))
			// Map to domain-like structure for frontend compatibility
			return c.JSON(fiber.Map{
				"call_id":      resp.CallId,
				"transcript":   h.formatTranscript(json.RawMessage(resp.TranscriptJson)),
				"segments":     json.RawMessage(resp.TranscriptJson),
				"stt_provider": resp.SttProvider,
			})
		}
		log.Debug("gRPC transcript fetch failed, falling back to DB", zap.String("call_id", id), zap.Error(err))
	}

	transcript, err := h.transcriptRepo.GetByCallID(c.Context(), internalID)
	if err != nil {
		log.Warn("transcript not found", zap.String("call_id", internalID), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transcript not found"})
	}

	transcript.Transcript = h.formatTranscript(transcript.SpeakerDiarizedJSON)

	log.Info("transcript fetched from DB", zap.String("call_id", internalID))
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

	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	log.Debug("fetching analysis", zap.String("call_id", id))

	// Resolve the internal UUID first
	call, err := h.callRepo.GetByID(c.Context(), id, companyID)
	if err != nil {
		log.Warn("call not found or unauthorized access for analysis", zap.String("call_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}
	internalID := call.ID

	// Try gRPC first if client is available
	if h.grpcClient != nil {
		resp, err := h.grpcClient.GetAnalysis(c.Context(), internalID)
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
				"sentiment":  "Neutral",
				"objections": []string{},
				"next_steps": strings.Split(resp.NextBestAction, "\n"),
			})
		}
		log.Debug("gRPC analysis fetch failed, falling back to DB", zap.String("call_id", id), zap.Error(err))
	}

	analysis, err := h.analysisRepo.GetByCallID(c.Context(), internalID)
	if err != nil {
		// If analysis is not found, return a 200 with an explicit empty response so
		// frontend can render a friendly 'not yet processed' state instead of an error.
		if err.Error() == "analysis report not found" {
			log.Warn("analysis not found", zap.String("call_id", internalID), zap.Error(err))
			return c.JSON(fiber.Map{
				"call_id":  internalID,
				"analysis": nil,
				"message":  "Analysis not found",
			})
		}

		// Other errors are treated as internal errors
		log.Error("failed to fetch analysis", zap.String("call_id", internalID), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	log.Info("analysis fetched from DB", zap.String("call_id", internalID))
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
	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	log.Info("call reprocess requested", zap.String("call_id", id), zap.String("user_id", userID))

	// Resolve the internal UUID and check company ownership
	_, err := h.callRepo.GetByID(c.Context(), id, companyID)
	if err != nil {
		log.Warn("call not found or unauthorized access for reprocess", zap.String("call_id", id), zap.String("company_id", companyID), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}

	err = h.reprocessCallUC.Execute(c.Context(), id, companyID)
	if err != nil {
		log.Error("failed to reprocess call", zap.String("call_id", id), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

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
// @Router /calls/:id/audio [get]
func (h *CallHandler) GetAudio(c *fiber.Ctx) error {
	id := c.Params("id")

	companyID, ok := c.Locals("company_id").(string)
	if !ok || companyID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: company_id not found"})
	}

	call, err := h.callRepo.GetByID(c.Context(), id, companyID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Call not found"})
	}
	var bucketName, objectName string

	// Prefer redirecting to original HTTP-based links early (e.g. Sipuni)
	// Only redirect if force_storage is not set to true
	forceStorage := c.Query("force_storage") == "true"
	if strings.HasPrefix(call.CallLink, "http") && !forceStorage {
		return c.Redirect(call.CallLink)
	}

	// Determine storage path: prefer storage_link, fallback to call_link if it contains minio://
	storageLink := ""
	if call.StorageLink != nil && *call.StorageLink != "" {
		storageLink = *call.StorageLink
	} else if strings.HasPrefix(call.CallLink, "minio://") {
		storageLink = call.CallLink
	}

	if strings.HasPrefix(storageLink, "minio://") {
		parts := strings.Split(strings.TrimPrefix(storageLink, "minio://"), "/")
		if len(parts) >= 2 {
			bucketName = parts[0]
			objectName = strings.Join(parts[1:], "/")
		}
	}

	if bucketName == "" {
		// Final fallback to older convention: bucket 'audio' and id.wav (legacy)
		bucketName = "audio"
		objectName = fmt.Sprintf("%s.wav", call.ID)
	}

	// Use a short context timeout to avoid hanging requests
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	// First, check object metadata to determine existence and content-type
	objInfo, err := h.minioClient.StatObject(ctx, bucketName, objectName, minio.StatObjectOptions{})
	if err != nil {
		// If it's an HTTP link we already handled above. For MinIO errors map Access Denied -> 403
		log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_audio"))
		lowerErr := strings.ToLower(err.Error())
		if strings.Contains(lowerErr, "access denied") || strings.Contains(lowerErr, "accessdenied") {
			log.Warn("minio stat object access denied", zap.String("bucket", bucketName), zap.String("object", objectName), zap.Error(err))
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied to audio object (check MinIO credentials/policy)"})
		}

		log.Warn("minio stat object failed", zap.String("bucket", bucketName), zap.String("object", objectName), zap.Error(err))
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Audio file not found in storage"})
	}

	// If presign mode is enabled, return a presigned URL instead of proxying
	if h.presignEnabled {
		// generate presigned URL
		// Use publicMinioClient if available for correct signature and host
		client := h.minioClient
		if h.publicMinioClient != nil {
			client = h.publicMinioClient
		}

		presignedURL, err := client.PresignedGetObject(ctx, bucketName, objectName, h.presignExpiry, neturl.Values{})
		if err != nil {
			log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_audio"))
			log.Error("failed to generate presigned url", zap.String("bucket", bucketName), zap.String("object", objectName), zap.Error(err))
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate presigned URL"})
		}

		return c.JSON(fiber.Map{"presigned_url": presignedURL.String(), "expires_in_seconds": int(h.presignExpiry.Seconds())})
	}

	// Open the object for streaming
	reader, err := h.minioClient.GetObject(ctx, bucketName, objectName, minio.GetObjectOptions{})
	if err != nil {
		log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_audio"))
		log.Error("minio get object failed", zap.String("bucket", bucketName), zap.String("object", objectName), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to open audio stream"})
	}
	// Do not defer Close until after we start streaming (fiber SendStream will read), but ensure close on exit
	defer reader.Close()

	// Use content-type from object metadata if available; if missing, infer from extension
	contentType := objInfo.ContentType
	if contentType == "" {
		lowerName := strings.ToLower(objectName)
		switch {
		case strings.HasSuffix(lowerName, ".wav"):
			contentType = "audio/wav"
		case strings.HasSuffix(lowerName, ".mp3"):
			contentType = "audio/mpeg"
		case strings.HasSuffix(lowerName, ".ogg"):
			contentType = "audio/ogg"
		case strings.HasSuffix(lowerName, ".m4a"):
			contentType = "audio/mp4"
		default:
			contentType = "application/octet-stream"
		}
	}
	c.Set("Content-Type", contentType)
	// set content length when available
	c.Set("Content-Length", strconv.FormatInt(objInfo.Size, 10))

	return c.SendStream(reader)
}

func (h *CallHandler) formatTranscript(raw json.RawMessage) string {
	var segments []struct {
		Speaker string `json:"speaker"`
		Text    string `json:"text"`
	}
	if err := json.Unmarshal(raw, &segments); err != nil {
		return ""
	}

	var lines []string
	for _, seg := range segments {
		lines = append(lines, fmt.Sprintf("[%s]: %s", seg.Speaker, seg.Text))
	}
	return strings.Join(lines, "\n")
}
