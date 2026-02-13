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

func (uc *IntegrationUseCase) Save(ctx context.Context, companyID string, it domain.IntegrationType, credentials, config json.RawMessage, isActive bool) (*domain.Integration, error) {
	existing, err := uc.repo.GetByType(ctx, companyID, it)
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

func (uc *IntegrationUseCase) ListByCompany(ctx context.Context, companyID string) ([]*domain.Integration, error) {
	return uc.repo.ListByCompany(ctx, companyID)
}

func (uc *IntegrationUseCase) GetByType(ctx context.Context, companyID string, it domain.IntegrationType) (*domain.Integration, error) {
	return uc.repo.GetByType(ctx, companyID, it)
}

func (uc *IntegrationUseCase) Delete(ctx context.Context, companyID string, it domain.IntegrationType) error {
	return uc.repo.Delete(ctx, companyID, it)
}
