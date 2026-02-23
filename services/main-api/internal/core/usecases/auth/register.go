package auth

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type RegisterRequest struct {
	CompanyName string `json:"company_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	FullName    string `json:"full_name"`
	ManagerName string `json:"manager_name"`
	ManagerID   string `json:"manager_id,omitempty"`
}

type RegisterResponse struct {
	User    *domain.User     `json:"user"`
	Company *domain.Company  `json:"company"`
	Tokens  *ports.TokenPair `json:"tokens"`
}

type RegisterUseCase struct {
	userRepo    ports.UserRepository
	companyRepo ports.CompanyRepository
	jwtService  ports.JWTService
}

func NewRegisterUseCase(
	userRepo ports.UserRepository,
	companyRepo ports.CompanyRepository,
	jwtService ports.JWTService,
) *RegisterUseCase {
	return &RegisterUseCase{
		userRepo:    userRepo,
		companyRepo: companyRepo,
		jwtService:  jwtService,
	}
}

func (uc *RegisterUseCase) Execute(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	// Check if email already exists
	existing, _ := uc.userRepo.GetByEmail(ctx, req.Email)
	if existing != nil {
		return nil, errors.New("email already registered")
	}

	// Create a new company for the user
	company := &domain.Company{
		ID:                 uuid.New().String(),
		Name:               req.CompanyName,
		STTModelPreference: domain.STTWhisperXLocal,
		LLMProvider:        domain.LLMOpenAI,
		SubscriptionTier:   "basic",
		IsActive:           true,
	}
	err := uc.companyRepo.Create(ctx, company)
	if err != nil {
		return nil, err
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	managerID := req.ManagerID
	if managerID == "" {
		managerID = "001"
	}

	user := &domain.User{
		ID:           uuid.New().String(),
		CompanyID:    company.ID,
		Email:        req.Email,
		FirstName:    req.FullName, // Simplified for now, or split if needed
		PasswordHash: string(passwordHash),
		Role:         domain.RoleTenantAdmin,
		ManagerID:    &managerID,
		ManagerName:  req.ManagerName,
		IsActive:     true,
	}

	err = uc.userRepo.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	// Link user to company in user_companies table
	err = uc.userRepo.AddUserToCompany(ctx, user.ID, company.ID, domain.RoleTenantAdmin)
	if err != nil {
		return nil, err
	}

	// Generate tokens
	tokens, err := uc.jwtService.GenerateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &RegisterResponse{
		User:    user,
		Company: company,
		Tokens:  tokens,
	}, nil
}
