package integrations

import (
	"context"
	"encoding/json"
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
