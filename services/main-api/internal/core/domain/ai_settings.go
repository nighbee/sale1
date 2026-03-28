package domain

import "time"

type AISettings struct {
	ID          string    `json:"id"`
	STTProvider string    `json:"stt_provider"`
	STTModel    *string   `json:"stt_model,omitempty"`
	LLMProvider string    `json:"llm_provider"`
	LLMModel    *string   `json:"llm_model,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
