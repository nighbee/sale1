package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type IntegrationUseCase struct {
	repo ports.IntegrationRepository
}

func NewIntegrationUseCase(repo ports.IntegrationRepository) *IntegrationUseCase {
	return &IntegrationUseCase{repo: repo}
}

func (uc *IntegrationUseCase) Save(ctx context.Context, companyID string, it domain.IntegrationType, credentials, config json.RawMessage, isActive bool) (*domain.Integration, error) {
	existing, err := uc.repo.GetByType(ctx, it, companyID)
	if err == nil {
		existing.Credentials = credentials
		existing.Config = config
		existing.IsActive = isActive
		err = uc.repo.Update(ctx, existing)
		return existing, err
	}

	integration := &domain.Integration{
		ID:              uuid.New().String(),
		CompanyID:       companyID,
		IntegrationType: it,
		Credentials:     credentials,
		Config:          config,
		IsActive:        isActive,
	}
	err = uc.repo.Create(ctx, integration)
	return integration, err
}

func (uc *IntegrationUseCase) List(ctx context.Context, companyID string) ([]*domain.Integration, error) {
	return uc.repo.List(ctx, companyID)
}

func (uc *IntegrationUseCase) GetByType(ctx context.Context, companyID string, it domain.IntegrationType) (*domain.Integration, error) {
	return uc.repo.GetByType(ctx, it, companyID)
}

func (uc *IntegrationUseCase) Delete(ctx context.Context, companyID string, it domain.IntegrationType) error {
	return uc.repo.Delete(ctx, it, companyID)
}

func (uc *IntegrationUseCase) ListAllActive(ctx context.Context) ([]*domain.Integration, error) {
	return uc.repo.ListAllActive(ctx)
}

func (uc *IntegrationUseCase) ListActiveByCompany(ctx context.Context, companyID string) ([]*domain.Integration, error) {
	return uc.repo.ListActiveByCompany(ctx, companyID)
}

func (uc *IntegrationUseCase) GetModels(ctx context.Context, companyID string, it domain.IntegrationType, credentials json.RawMessage, category string) (map[string]interface{}, error) {
	sttServiceURL := os.Getenv("STT_SERVICE_URL")
	if sttServiceURL == "" {
		sttServiceURL = "http://stt-service:8001"
	}
	url := sttServiceURL + "/api/v1/models"

	payload := map[string]interface{}{
		"provider_name": string(it),
		"credentials":   nil,
		"category":      category,
	}

	if len(credentials) == 0 || string(credentials) == "null" {
		existing, err := uc.repo.GetByType(ctx, it, companyID)
		if err == nil {
			credentials = existing.Credentials
		}
	}

	if len(credentials) > 0 && string(credentials) != "null" {
		var creds map[string]interface{}
		if err := json.Unmarshal(credentials, &creds); err == nil {
			payload["credentials"] = creds
		}
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stt-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		if detail, ok := result["detail"].(string); ok {
			return nil, errors.New(detail)
		}
		return nil, fmt.Errorf("stt-service error (status %d)", resp.StatusCode)
	}

	return result, nil
}

func (uc *IntegrationUseCase) CheckModel(ctx context.Context, companyID string, it domain.IntegrationType, credentials json.RawMessage, model string) (map[string]interface{}, error) {
	sttServiceURL := os.Getenv("STT_SERVICE_URL")
	if sttServiceURL == "" {
		sttServiceURL = "http://stt-service:8001"
	}
	url := sttServiceURL + "/api/v1/check-model"

	payload := map[string]interface{}{
		"provider_name": string(it),
		"credentials":   nil,
		"model":         model,
	}

	if len(credentials) == 0 || string(credentials) == "null" {
		existing, err := uc.repo.GetByType(ctx, it, companyID)
		if err == nil {
			credentials = existing.Credentials
			if model == "" {
				var cfg struct {
					Model string `json:"model"`
				}
				if err := json.Unmarshal(existing.Config, &cfg); err == nil {
					model = cfg.Model
				}
			}
		}
	}

	if len(credentials) > 0 && string(credentials) != "null" {
		var creds map[string]interface{}
		if err := json.Unmarshal(credentials, &creds); err == nil {
			payload["credentials"] = creds
		}
	}
	payload["model"] = model

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stt-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		if detail, ok := result["detail"].(string); ok {
			return nil, errors.New(detail)
		}
		return nil, fmt.Errorf("stt-service error (status %d)", resp.StatusCode)
	}

	return result, nil
}

func (uc *IntegrationUseCase) TestConnection(ctx context.Context, companyID string, it domain.IntegrationType, credentials, config json.RawMessage) error {
	// If credentials or config are not provided in request, fetch from DB
	if len(credentials) == 0 || string(credentials) == "null" {
		existing, err := uc.repo.GetByType(ctx, it, companyID)
		if err != nil {
			return fmt.Errorf("no credentials provided and none found in database for %s", it)
		}
		credentials = existing.Credentials
		config = existing.Config
	}

	switch it {
	case domain.IntegrationOpenAI, domain.IntegrationGroq, domain.IntegrationDeepgram, domain.IntegrationGemini, domain.IntegrationElevenLabs, domain.IntegrationSoniox:
		return uc.testAIProvider(ctx, it, credentials)

	case domain.IntegrationSipuni:
		return uc.testSipuni(ctx, credentials)

	case domain.IntegrationTelegram:
		return uc.testTelegram(ctx, credentials)

	case domain.IntegrationSlack:
		return uc.testSlack(ctx, credentials)

	case domain.IntegrationAmoCRM:
		return uc.testAmoCRM(ctx, credentials, config)

	default:
		return fmt.Errorf("unsupported integration type for testing: %s", it)
	}
}

func (uc *IntegrationUseCase) testAIProvider(ctx context.Context, it domain.IntegrationType, credentials json.RawMessage) error {
	var creds struct {
		APIKey string `json:"api_key"`
	}
	if err := json.Unmarshal(credentials, &creds); err != nil {
		return errors.New("invalid credentials format")
	}
	if creds.APIKey == "" {
		return errors.New("API Key is required")
	}

	var url string
	var authHeader string
	var authValue string

	switch it {
	case domain.IntegrationOpenAI:
		url = "https://api.openai.com/v1/models"
		authHeader = "Authorization"
		authValue = "Bearer " + creds.APIKey
	case domain.IntegrationGroq:
		url = "https://api.groq.com/openai/v1/models"
		authHeader = "Authorization"
		authValue = "Bearer " + creds.APIKey
	case domain.IntegrationDeepgram:
		url = "https://api.deepgram.com/v1/projects"
		authHeader = "Authorization"
		authValue = "Token " + creds.APIKey
	case domain.IntegrationGemini:
		url = fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", creds.APIKey)
	case domain.IntegrationElevenLabs:
		url = "https://api.elevenlabs.io/v1/models"
		authHeader = "xi-api-key"
		authValue = creds.APIKey
	case domain.IntegrationSoniox:
		url = "https://api.soniox.com/v1/transcriptions"
		authHeader = "Authorization"
		authValue = "Bearer " + creds.APIKey
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	if authHeader != "" {
		req.Header.Set(authHeader, authValue)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach %s: %w", it, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s validation failed with status: %d", it, resp.StatusCode)
	}
	return nil
}

func (uc *IntegrationUseCase) testSipuni(ctx context.Context, credentials json.RawMessage) error {
	var creds struct {
		APIKey string `json:"api_key"`
	}
	if err := json.Unmarshal(credentials, &creds); err != nil {
		return errors.New("invalid credentials format")
	}
	if creds.APIKey == "" {
		return errors.New("Sipuni API Key is required")
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}

	c, _, err := dialer.DialContext(ctx, "wss://wss.sipuni.com/api", nil)
	if err != nil {
		return fmt.Errorf("failed to connect to Sipuni WebSocket: %w", err)
	}
	defer c.Close()

	authMsg := map[string]interface{}{
		"type": "auth",
		"body": map[string]string{"key": creds.APIKey},
	}
	if err := c.WriteJSON(authMsg); err != nil {
		return fmt.Errorf("failed to send auth message to Sipuni: %w", err)
	}

	c.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		var resp struct {
			Action string `json:"action"`
			Status int    `json:"status"`
		}
		err := c.ReadJSON(&resp)
		if err != nil {
			return fmt.Errorf("failed to read response from Sipuni: %w", err)
		}
		if resp.Action == "auth" {
			if resp.Status == 1 {
				return nil
			}
			return errors.New("Sipuni authentication failed: invalid API key")
		}
	}
}

func (uc *IntegrationUseCase) testTelegram(ctx context.Context, credentials json.RawMessage) error {
	var creds struct {
		BotToken string `json:"bot_token"`
	}
	if err := json.Unmarshal(credentials, &creds); err != nil {
		return errors.New("invalid credentials format")
	}
	if creds.BotToken == "" {
		return errors.New("Bot Token is required")
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/getMe", creds.BotToken)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Telegram: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Telegram validation failed with status: %d", resp.StatusCode)
	}
	return nil
}

func (uc *IntegrationUseCase) testSlack(ctx context.Context, credentials json.RawMessage) error {
	var creds struct {
		WebhookURL string `json:"webhook_url"`
	}
	if err := json.Unmarshal(credentials, &creds); err != nil {
		return errors.New("invalid credentials format")
	}
	if creds.WebhookURL == "" {
		return errors.New("Webhook URL is required")
	}

	// We'll send a dummy challenge or just check if URL is reachable.
	// Actually, sending a message might be too intrusive, but it's the only way to test a webhook.
	// Let's just try a HEAD or GET if possible, but webhooks usually only accept POST.
	// We'll send a "Connection Test" message.
	payload := map[string]string{"text": "SalesAI Integration Test: Connection Successful"}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", creds.WebhookURL, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Slack: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack validation failed with status: %d", resp.StatusCode)
	}
	return nil
}

func (uc *IntegrationUseCase) testAmoCRM(ctx context.Context, credentials, config json.RawMessage) error {
	var creds struct {
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
	}
	var cfg struct {
		Subdomain string `json:"subdomain"`
	}
	if err := json.Unmarshal(credentials, &creds); err != nil {
		return errors.New("invalid credentials format")
	}
	if err := json.Unmarshal(config, &cfg); err != nil {
		return errors.New("invalid config format")
	}

	if cfg.Subdomain == "" || creds.ClientID == "" || creds.ClientSecret == "" {
		return errors.New("subdomain, client_id, and client_secret are required")
	}

	// AmoCRM usually requires an auth code to get initial token.
	// Testing without a token is hard. We'll just check if the subdomain exists.
	url := fmt.Sprintf("https://%s.amocrm.ru/api/v4/account", cfg.Subdomain)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach AmoCRM: %w", err)
	}
	defer resp.Body.Close()

	// 401 is expected if credentials are not yet authorized, but it means the subdomain is correct.
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusUnauthorized {
		return fmt.Errorf("AmoCRM validation failed with status: %d", resp.StatusCode)
	}

	return nil
}
