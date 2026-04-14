package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockIntegrationRepository struct {
	mock.Mock
}

func (m *MockIntegrationRepository) Create(ctx context.Context, integration *domain.Integration) error {
	args := m.Called(ctx, integration)
	return args.Error(0)
}

func (m *MockIntegrationRepository) GetByType(ctx context.Context, it domain.IntegrationType, companyID string) (*domain.Integration, error) {
	args := m.Called(ctx, it, companyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Integration), args.Error(1)
}

func (m *MockIntegrationRepository) List(ctx context.Context, companyID string) ([]*domain.Integration, error) {
	args := m.Called(ctx, companyID)
	return args.Get(0).([]*domain.Integration), args.Error(1)
}

func (m *MockIntegrationRepository) ListAllActive(ctx context.Context) ([]*domain.Integration, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*domain.Integration), args.Error(1)
}

func (m *MockIntegrationRepository) ListActiveByCompany(ctx context.Context, companyID string) ([]*domain.Integration, error) {
	args := m.Called(ctx, companyID)
	return args.Get(0).([]*domain.Integration), args.Error(1)
}

func (m *MockIntegrationRepository) Update(ctx context.Context, integration *domain.Integration) error {
	args := m.Called(ctx, integration)
	return args.Error(0)
}

func (m *MockIntegrationRepository) Delete(ctx context.Context, it domain.IntegrationType, companyID string) error {
	args := m.Called(ctx, it, companyID)
	return args.Error(0)
}

func TestTestConnection_InvalidType(t *testing.T) {
	repo := new(MockIntegrationRepository)
	uc := NewIntegrationUseCase(repo)

	// Since TestConnection calls repo.GetByType when credentials are empty
	repo.On("GetByType", mock.Anything, domain.IntegrationType("invalid_type"), "comp-1").Return(nil, errors.New("not found"))

	err := uc.TestConnection(context.Background(), "comp-1", "invalid_type", nil, nil)
	assert.Error(t, err)
}

func TestTestConnection_NoCredentials(t *testing.T) {
	repo := new(MockIntegrationRepository)
	uc := NewIntegrationUseCase(repo)

	repo.On("GetByType", mock.Anything, domain.IntegrationSipuni, "comp-1").Return(nil, errors.New("not found"))

	err := uc.TestConnection(context.Background(), "comp-1", domain.IntegrationSipuni, nil, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no credentials provided")
}

func TestTestConnection_Sipuni_MissingKey(t *testing.T) {
	repo := new(MockIntegrationRepository)
	uc := NewIntegrationUseCase(repo)

	creds := json.RawMessage(`{"other": "field"}`)
	err := uc.TestConnection(context.Background(), "comp-1", domain.IntegrationSipuni, creds, nil)
	assert.Error(t, err)
	assert.Equal(t, "Sipuni API Key is required", err.Error())
}

func TestTestConnection_AIProvider_MissingKey(t *testing.T) {
	repo := new(MockIntegrationRepository)
	uc := NewIntegrationUseCase(repo)

	creds := json.RawMessage(`{}`)
	err := uc.TestConnection(context.Background(), "comp-1", domain.IntegrationOpenAI, creds, nil)
	assert.Error(t, err)
	assert.Equal(t, "API Key is required", err.Error())
}
