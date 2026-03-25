package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Integration struct {
	ID              string          `json:"id"`
	IntegrationType string          `json:"integration_type"`
	Credentials     json.RawMessage `json:"credentials"`
	Config          json.RawMessage `json:"config"`
	IsActive        bool            `json:"is_active"`
}

type MainAPIClient struct {
	baseURL        string
	internalSecret string
	client         *http.Client
}

func NewMainAPIClient() *MainAPIClient {
	baseURL := os.Getenv("MAIN_API_URL")
	if baseURL == "" {
		baseURL = "http://main-api:8080"
	}
	secret := os.Getenv("INTERNAL_SECRET")
	if secret == "" {
		secret = "internal-secret-key"
	}
	return &MainAPIClient{
		baseURL:        baseURL,
		internalSecret: secret,
		client:         &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *MainAPIClient) GetActiveIntegrations() ([]Integration, error) {
	url := fmt.Sprintf("%s/api/v1/internal/integrations", c.baseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Internal-Secret", c.internalSecret)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("main-api returned status %d", resp.StatusCode)
	}

	var result struct {
		Integrations []Integration `json:"integrations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Integrations, nil
}
