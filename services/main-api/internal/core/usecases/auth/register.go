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
	Email       string `json:"email"`
	Password    string `json:"password"`
	FullName    string `json:"full_name"`
	Phone       string `json:"phone"`
	ManagerName string `json:"manager_name"`
	ManagerID   string `json:"manager_id,omitempty"`
}

type RegisterResponse struct {
	User   *domain.User     `json:"user"`
	Tokens *ports.TokenPair `json:"tokens"`
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
	existing, err := uc.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		// If the error is anything other than "user not found", return it up the stack
		if err.Error() != "user not found" {
			return nil, err
		}
	}
	if existing != nil {
		return nil, errors.New("email already registered")
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create Company first
	company := &domain.Company{
		ID:       uuid.New().String(),
		Name:     req.FullName + "'s Company",
		IsActive: true,
	}

	err = uc.companyRepo.Create(ctx, company)
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
		FirstName:    req.FullName,
		PasswordHash: string(passwordHash),
		Role:         domain.RoleTenantAdmin, // Default first user as tenant_admin
		ManagerID:    &managerID,
		ManagerName:  req.ManagerName,
		Phone:        req.Phone,
		IsActive:     true,
	}

	err = uc.userRepo.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	// Generate tokens
	tokens, err := uc.jwtService.GenerateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &RegisterResponse{
		User:   user,
		Tokens: tokens,
	}, nil
}
