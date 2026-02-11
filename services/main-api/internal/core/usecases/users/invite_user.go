package users

import (
	"context"
	"github.com/google/uuid"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type InviteUserRequest struct {
	Email       string `json:"email"`
	Role        string `json:"role"`
	ManagerName string `json:"manager_name"`
	ManagerID   string `json:"manager_id,omitempty"`
}

type InviteUserUseCase struct {
	userRepo ports.UserRepository
}

func NewInviteUserUseCase(userRepo ports.UserRepository) *InviteUserUseCase {
	return &InviteUserUseCase{userRepo: userRepo}
}

func (uc *InviteUserUseCase) Execute(ctx context.Context, companyID string, req InviteUserRequest) (*domain.User, error) {
	user := &domain.User{
		ID:           uuid.New().String(),
		CompanyID:    companyID,
		Email:        req.Email,
		PasswordHash: "INVITED", // Should be handled by invite flow
		Role:         domain.UserRole(req.Role),
		ManagerID:    &req.ManagerID,
		ManagerName:  req.ManagerName,
		IsActive:     true,
	}

	err := uc.userRepo.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	return user, nil
}
