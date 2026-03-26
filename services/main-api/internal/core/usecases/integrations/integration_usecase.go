package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type IntegrationUseCase struct {
	repo ports.IntegrationRepository
}

func NewIntegrationUseCase(repo ports.IntegrationRepository) *IntegrationUseCase {
	return &IntegrationUseCase{repo: repo}
}

func (uc *IntegrationUseCase) Save(ctx context.Context, it domain.IntegrationType, credentials, config json.RawMessage, isActive bool) (*domain.Integration, error) {
	existing, err := uc.repo.GetByType(ctx, it)
	if err == nil {
		existing.Credentials = credentials
		existing.Config = config
		existing.IsActive = isActive
		err = uc.repo.Update(ctx, existing)
		return existing, err
	}

	integration := &domain.Integration{
		ID:              uuid.New().String(),
		IntegrationType: it,
		Credentials:     credentials,
		Config:          config,
		IsActive:        isActive,
	}
	err = uc.repo.Create(ctx, integration)
	return integration, err
}

func (uc *IntegrationUseCase) List(ctx context.Context) ([]*domain.Integration, error) {
	return uc.repo.List(ctx)
}

func (uc *IntegrationUseCase) GetByType(ctx context.Context, it domain.IntegrationType) (*domain.Integration, error) {
	return uc.repo.GetByType(ctx, it)
}

func (uc *IntegrationUseCase) Delete(ctx context.Context, it domain.IntegrationType) error {
	return uc.repo.Delete(ctx, it)
}

func (uc *IntegrationUseCase) ListAllActive(ctx context.Context) ([]*domain.Integration, error) {
	return uc.repo.ListAllActive(ctx)
}

func (uc *IntegrationUseCase) TestConnection(ctx context.Context, it domain.IntegrationType, credentials, config json.RawMessage) error {
	// If credentials or config are not provided in request, fetch from DB
	if len(credentials) == 0 || string(credentials) == "null" {
		existing, err := uc.repo.GetByType(ctx, it)
		if err != nil {
			return fmt.Errorf("no credentials provided and none found in database for %s", it)
		}
		credentials = existing.Credentials
		config = existing.Config
	}

	switch it {
	case "openai", "groq", "deepgram", "gemini":
		var creds struct {
			APIKey string `json:"api_key"`
		}
		if err := json.Unmarshal(credentials, &creds); err != nil {
			return errors.New("invalid credentials format")
		}
		if creds.APIKey == "" {
			return errors.New("API Key is required")
		}

		// Simple check for OpenAI
		if it == "openai" {
			req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.openai.com/v1/models", nil)
			req.Header.Set("Authorization", "Bearer "+creds.APIKey)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("OpenAI check failed with status: %d", resp.StatusCode)
			}
		}
		// In a real scenario, we'd add checks for others too.
		return nil

	case "sipuni":
		var creds struct {
			APIKey string `json:"api_key"`
		}
		json.Unmarshal(credentials, &creds)
		if creds.APIKey == "" {
			return errors.New("Sipuni API Key is required")
		}
		// Placeholder for Sipuni check logic
		return nil

	case "google_sheets":
		var cfg struct {
			SpreadsheetID string `json:"spreadsheet_id"`
		}
		json.Unmarshal(config, &cfg)
		if cfg.SpreadsheetID == "" {
			return errors.New("Spreadsheet ID is required")
		}
		// In production we would check Google Auth here
		return nil

	default:
		return nil
	}
}
