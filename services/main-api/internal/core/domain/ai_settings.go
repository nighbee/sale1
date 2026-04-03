package domain

import "time"

type AISettings struct {
	ID                    string    `json:"id"`
	STTProvider           string    `json:"stt_provider"`
	STTModel              *string   `json:"stt_model,omitempty"`
	STTLanguage           *string   `json:"stt_language,omitempty"`
	LLMProvider           string    `json:"llm_provider"`
	LLMModel              *string   `json:"llm_model,omitempty"`
	CircuitBreakerEnabled bool      `json:"circuit_breaker_enabled"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}
