package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
)

func init() {
	applogger.Init("test")
}

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
		m.analysis.NextSteps = []string{m.analysis.NextBestAction}
	}
	return m.analysis, m.err
}
func (m *mockAnalysisRepo) GetTeamPerformance(ctx context.Context, filters map[string]interface{}) ([]map[string]interface{}, error) {
	return nil, nil
}

func TestGetTranscript_Mapping(t *testing.T) {
	app := fiber.New()

	mockTranscript := &domain.Transcript{
		CallID:              "call-123",
		SpeakerDiarizedJSON: json.RawMessage(`[{"speaker":"A","text":"hello"}]`),
		STTProvider:         "openai",
	}

	h := &CallHandler{
		transcriptRepo: &mockTranscriptRepo{transcript: mockTranscript},
	}

	app.Get("/calls/:id/transcript", h.GetTranscript)

	req := httptest.NewRequest("GET", "/calls/call-123/transcript", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	// Check if "segments" exists instead of "speaker_diarized_json"
	if _, ok := result["segments"]; !ok {
		t.Errorf("expected 'segments' field in response")
	}
}

func TestGetAnalysis_Mapping(t *testing.T) {
	app := fiber.New()

	mockAnalysis := &domain.AnalysisReport{
		CallID:         "call-123",
		Brief:          "This is a summary",
		NextBestAction: "Action 1",
		ProcessedAt:    time.Now(),
	}

	h := &CallHandler{
		analysisRepo: &mockAnalysisRepo{analysis: mockAnalysis},
	}

	app.Get("/calls/:id/analysis", h.GetAnalysis)

	req := httptest.NewRequest("GET", "/calls/call-123/analysis", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["summary"] != "This is a summary" {
		t.Errorf("expected summary 'This is a summary', got %v", result["summary"])
	}
	if steps, ok := result["next_steps"].([]interface{}); !ok || len(steps) == 0 || steps[0] != "Action 1" {
		t.Errorf("expected next_steps to contain 'Action 1', got %v", result["next_steps"])
	}
}
