package domain

import (
	"encoding/json"
	"time"
)

type IntegrationType string

const (
	IntegrationAmoCRM       IntegrationType = "amocrm"
	IntegrationGoogleSheets IntegrationType = "google_sheets"
	IntegrationTelegram     IntegrationType = "telegram"
	IntegrationSlack        IntegrationType = "slack"
)

type Integration struct {
	ID              string          `json:"id"`
	IntegrationType IntegrationType `json:"integration_type"`
	Credentials     json.RawMessage `json:"credentials"`
	Config          json.RawMessage `json:"config"`
	IsActive        bool            `json:"is_active"`
	LastSync        *time.Time      `json:"last_sync"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}
