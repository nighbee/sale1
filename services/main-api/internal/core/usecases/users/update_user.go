package users

import (
	"context"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type UpdateUserRequest struct {
	ManagerName string `json:"manager_name"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
}

type UpdateUserUseCase struct {
	userRepo ports.UserRepository
}

func NewUpdateUserUseCase(userRepo ports.UserRepository) *UpdateUserUseCase {
	return &UpdateUserUseCase{userRepo: userRepo}
}

func (uc *UpdateUserUseCase) Execute(ctx context.Context, id string, req UpdateUserRequest) (*domain.User, error) {
	user, err := uc.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.ManagerName != "" {
		user.ManagerName = req.ManagerName
	}
	if req.Role != "" {
		user.Role = domain.UserRole(req.Role)
	}
	user.IsActive = req.IsActive

	err = uc.userRepo.Update(ctx, user)
	if err != nil {
		return nil, err
	}

	return user, nil
}
