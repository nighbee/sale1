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
	Description        string      `json:"description"`
	Industry           string      `json:"industry"`
	Size               string      `json:"size"`
	ManagersCount      int         `json:"managers_count"`
	TimeZone           string      `json:"time_zone"`
	STTModelPreference STTModel    `json:"stt_model_preference"`
	LLMProvider        LLMProvider `json:"llm_provider"`
	SubscriptionTier   string      `json:"subscription_tier"`
	IsActive           bool        `json:"is_active"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

type BillingInfo struct {
	ID                string    `json:"id"`
	CardHolderName    string    `json:"card_holder_name"`
	CardNumberMasked  string    `json:"card_number_masked"`
	ExpirationDate    string    `json:"expiration_date"`
	CardType          string    `json:"card_type"`
	TokensUsed        int       `json:"tokens_used"`
	TokensLimit       int       `json:"tokens_limit"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
