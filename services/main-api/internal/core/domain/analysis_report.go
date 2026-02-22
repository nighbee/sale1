package domain

import (
	"time"
)

type AnalysisReport struct {
	ID                    string    `json:"id"`
	CallID                string    `json:"call_id"`
	ScriptID              *string   `json:"script_id,omitempty"`
	QualityScore          int       `json:"quality_score"`
	ScriptMatch           int       `json:"script_match"`
	ErrorsFree            int       `json:"errors_free"`
	OverallRating         float64   `json:"overall_rating"`
	KPI                   float64   `json:"kpi"`
	Recommendation        string    `json:"recommendation"`
	Brief                 string    `json:"brief"`
	NextBestAction        string    `json:"next_best_action"`
	LLMProvider           string    `json:"llm_provider"`
	ProcessedAt           time.Time `json:"processed_at"`

	// Frontend compatibility fields (calculated)
	Summary   string   `json:"summary"`
	NextSteps []string `json:"next_steps"`
}
