package billing

import (
	"context"
	"testing"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockCompanyRepository struct {
	mock.Mock
}

func (m *MockCompanyRepository) Create(ctx context.Context, company *domain.Company) error {
	args := m.Called(ctx, company)
	return args.Error(0)
}

func (m *MockCompanyRepository) GetByID(ctx context.Context, id string) (*domain.Company, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.Company), args.Error(1)
}

func (m *MockCompanyRepository) Update(ctx context.Context, company *domain.Company) error {
	args := m.Called(ctx, company)
	return args.Error(0)
}

func (m *MockCompanyRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.Company, int, error) {
	args := m.Called(ctx, filters)
	return args.Get(0).([]*domain.Company), args.Int(1), args.Error(2)
}

func (m *MockCompanyRepository) GetBillingInfo(ctx context.Context, companyID string) (*domain.BillingInfo, error) {
	args := m.Called(ctx, companyID)
	return args.Get(0).(*domain.BillingInfo), args.Error(1)
}

func (m *MockCompanyRepository) UpdateBillingInfo(ctx context.Context, billing *domain.BillingInfo) error {
	args := m.Called(ctx, billing)
	return args.Error(0)
}

type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, user *domain.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) GetByPhone(ctx context.Context, phone string) (*domain.User, error) {
	args := m.Called(ctx, phone)
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) Update(ctx context.Context, user *domain.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) DeleteGlobal(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) List(ctx context.Context, companyID string) ([]*domain.User, error) {
	args := m.Called(ctx, companyID)
	return args.Get(0).([]*domain.User), args.Error(1)
}

func (m *MockUserRepository) ListAll(ctx context.Context, filters map[string]interface{}) ([]*domain.User, int, error) {
	args := m.Called(ctx, filters)
	return args.Get(0).([]*domain.User), args.Int(1), args.Error(2)
}

func (m *MockUserRepository) GetByManagerID(ctx context.Context, managerID string, companyID string) (*domain.User, error) {
	args := m.Called(ctx, managerID, companyID)
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) GetBySrcNum(ctx context.Context, srcNum string, companyID string) (*domain.User, error) {
	args := m.Called(ctx, srcNum, companyID)
	return args.Get(0).(*domain.User), args.Error(1)
}

type MockPaymentProvider struct {
	mock.Mock
}

func (m *MockPaymentProvider) CreateCustomer(ctx context.Context, email, name string) (string, error) {
	args := m.Called(ctx, email, name)
	return args.String(0), args.Error(1)
}

func (m *MockPaymentProvider) CreateSetupIntent(ctx context.Context, customerID string) (string, string, error) {
	args := m.Called(ctx, customerID)
	return args.String(0), args.String(1), args.Error(2)
}

func TestCreateSetupIntent_NewCustomer(t *testing.T) {
	companyRepo := new(MockCompanyRepository)
	userRepo := new(MockUserRepository)
	payment := new(MockPaymentProvider)
	uc := NewBillingUseCase(companyRepo, userRepo, payment)

	ctx := context.Background()
	companyID := "comp-1"
	userID := "user-1"

	company := &domain.Company{ID: companyID, Name: "Test Comp"}
	billingInfo := &domain.BillingInfo{ID: companyID}
	user := &domain.User{ID: userID, Email: "test@example.com"}

	companyRepo.On("GetByID", ctx, companyID).Return(company, nil)
	companyRepo.On("GetBillingInfo", ctx, companyID).Return(billingInfo, nil)
	userRepo.On("GetByID", ctx, userID).Return(user, nil)
	payment.On("CreateCustomer", ctx, user.Email, company.Name).Return("cus_123", nil)
	companyRepo.On("UpdateBillingInfo", ctx, mock.MatchedBy(func(b *domain.BillingInfo) bool {
		return b.StripeCustomerID == "cus_123"
	})).Return(nil)
	payment.On("CreateSetupIntent", ctx, "cus_123").Return("si_123", "secret_123", nil)

	intentID, secret, err := uc.CreateSetupIntent(ctx, companyID, userID)

	assert.NoError(t, err)
	assert.Equal(t, "si_123", intentID)
	assert.Equal(t, "secret_123", secret)
	companyRepo.AssertExpectations(t)
	userRepo.AssertExpectations(t)
	payment.AssertExpectations(t)
}

func TestUpdateBilling(t *testing.T) {
	companyRepo := new(MockCompanyRepository)
	userRepo := new(MockUserRepository)
	payment := new(MockPaymentProvider)
	uc := NewBillingUseCase(companyRepo, userRepo, payment)

	ctx := context.Background()
	companyID := "comp-1"

	currentBilling := &domain.BillingInfo{
		ID:          companyID,
		TokensUsed:  100,
		TokensLimit: 1000,
	}
	updateReq := &domain.BillingInfo{
		CardHolderName: "John Doe",
	}

	companyRepo.On("GetBillingInfo", ctx, companyID).Return(currentBilling, nil)
	companyRepo.On("UpdateBillingInfo", ctx, mock.MatchedBy(func(b *domain.BillingInfo) bool {
		return b.CardHolderName == "John Doe" && b.TokensUsed == 100
	})).Return(nil)

	updated, err := uc.UpdateBilling(ctx, companyID, updateReq)

	assert.NoError(t, err)
	assert.Equal(t, "John Doe", updated.CardHolderName)
	assert.Equal(t, 100, updated.TokensUsed)
	companyRepo.AssertExpectations(t)
}
