package domain

import "time"

type STTModel string

const (
	STTWhisperXLocal STTModel = "whisperx_local"
	STTOpenAI        STTModel = "openai"
	STTGemini        STTModel = "gemini"
)

type LLMProvider string

const (
	LLMOpenAI LLMProvider = "openai"
	LLMGemini LLMProvider = "gemini"
)

type Company struct {
	ID                 string      `json:"id"`
	Name               string      `json:"name"`
	STTModelPreference STTModel    `json:"stt_model_preference"`
	LLMProvider        LLMProvider `json:"llm_provider"`
	SubscriptionTier   string      `json:"subscription_tier"`
	IsActive           bool        `json:"is_active"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}
