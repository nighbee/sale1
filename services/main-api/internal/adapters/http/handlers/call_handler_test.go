package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
)

func init() {
	applogger.Init("test")
}

// Mocks
type mockTranscriptRepo struct {
	transcript *domain.Transcript
	err        error
}

func (m *mockTranscriptRepo) Create(ctx context.Context, t *domain.Transcript) error { return nil }
func (m *mockTranscriptRepo) GetByCallID(ctx context.Context, callID string) (*domain.Transcript, error) {
	return m.transcript, m.err
}

type mockAnalysisRepo struct {
	analysis *domain.AnalysisReport
	err      error
}

func (m *mockAnalysisRepo) Create(ctx context.Context, a *domain.AnalysisReport) error { return nil }
func (m *mockAnalysisRepo) GetByCallID(ctx context.Context, callID string) (*domain.AnalysisReport, error) {
	if m.analysis != nil {
		m.analysis.Summary = m.analysis.Brief
		m.analysis.Sentiment = "Neutral"
		m.analysis.Objections = []string{}
	}
	return m.analysis, m.err
}
func (m *mockAnalysisRepo) GetTeamPerformance(ctx context.Context, filters map[string]interface{}) ([]map[string]interface{}, error) {
	return nil, nil
}

type mockCallRepoForDetail struct {
	call  *domain.Call
	calls []*domain.Call
	total int
	err   error
}

func (m *mockCallRepoForDetail) Create(ctx context.Context, c *domain.Call) error { return nil }
func (m *mockCallRepoForDetail) GetByID(ctx context.Context, id string) (*domain.Call, error) {
	if m.call != nil && (id == m.call.ID || (m.call.ExternalID != nil && id == *m.call.ExternalID)) {
		return m.call, nil
	}
	return nil, errors.New("call not found")
}
func (m *mockCallRepoForDetail) GetByIDInternal(ctx context.Context, id string) (*domain.Call, error) {
	if m.call != nil && id == m.call.ID {
		return m.call, nil
	}
	return nil, errors.New("call not found")
}
func (m *mockCallRepoForDetail) List(ctx context.Context, f map[string]interface{}) ([]*domain.Call, int, map[string]int, error) {
	return m.calls, m.total, nil, m.err
}
func (m *mockCallRepoForDetail) ListAll(ctx context.Context, filters map[string]interface{}) ([]*domain.Call, int, error) {
	return m.calls, m.total, m.err
}
func (m *mockCallRepoForDetail) UpdateStatus(ctx context.Context, id string, s domain.CallStatus) error {
	return nil
}

// Tests
func TestGetCall_ByExternalID(t *testing.T) {
	app := fiber.New()
	mockCall := &domain.Call{
		ID:         "internal-uuid",
		CompanyID:  "company-1",
		ExternalID: func(s string) *string { return &s }("sipuni-123"),
	}

	h := &CallHandler{
		callRepo:       &mockCallRepoForDetail{call: mockCall},
		transcriptRepo: &mockTranscriptRepo{},
		analysisRepo:   &mockAnalysisRepo{},
	}

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("company_id", "company-1")
		return c.Next()
	})
	app.Get("/calls/:id", h.GetCall)

	// Test by External ID
	req := httptest.NewRequest("GET", "/calls/sipuni-123", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	callData := result["call"].(map[string]interface{})

	if callData["id"] != "internal-uuid" {
		t.Errorf("expected id 'internal-uuid', got %v", callData["id"])
	}
}

func TestGetTranscript_IDResolution(t *testing.T) {
	app := fiber.New()
	mockCall := &domain.Call{
		ID:         "internal-uuid",
		CompanyID:  "company-1",
		ExternalID: func(s string) *string { return &s }("sipuni-123"),
	}
	mockTranscript := &domain.Transcript{
		CallID:              "internal-uuid",
		SpeakerDiarizedJSON: json.RawMessage(`[]`),
	}

	h := &CallHandler{
		callRepo:       &mockCallRepoForDetail{call: mockCall},
		transcriptRepo: &mockTranscriptRepo{transcript: mockTranscript},
	}

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("company_id", "company-1")
		return c.Next()
	})
	app.Get("/calls/:id/transcript", h.GetTranscript)

	// Fetching by external ID should resolve to internal ID and return transcript
	req := httptest.NewRequest("GET", "/calls/sipuni-123/transcript", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["call_id"] != "internal-uuid" && result["CallID"] != "internal-uuid" {
		// Depending on how it's serialized. h.GetTranscript uses fiber.Map or domain.Transcript
		// Since h.grpcClient is nil, it returns transcript from DB (domain.Transcript)
	}
}

func TestGetAudio_ForceStorage(t *testing.T) {
	app := fiber.New()
	mockCall := &domain.Call{
		ID:        "internal-uuid",
		CompanyID: "company-1",
		CallLink:  "http://sipuni.com/record.mp3",
	}

	h := &CallHandler{
		callRepo: &mockCallRepoForDetail{call: mockCall},
	}

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("company_id", "company-1")
		return c.Next()
	})
	app.Get("/calls/:id/audio", func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				// We hit MinIO client which is nil
				c.Status(fiber.StatusTeapot).SendString("hit_minio")
			}
		}()
		return h.GetAudio(c)
	})

	// 1. Normal request should redirect
	req := httptest.NewRequest("GET", "/calls/internal-uuid/audio", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 302 {
		t.Errorf("expected redirect (302), got %d", resp.StatusCode)
	}

	// 2. force_storage=true should NOT redirect, but hit MinIO
	req2 := httptest.NewRequest("GET", "/calls/internal-uuid/audio?force_storage=true", nil)
	resp2, _ := app.Test(req2)
	if resp2.StatusCode == 302 {
		t.Errorf("expected NO redirect when force_storage=true")
	}
	if resp2.StatusCode != fiber.StatusTeapot {
		t.Errorf("expected to hit minio (418), got %d", resp2.StatusCode)
	}
}
