package users

import (
	"context"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type ListUsersUseCase struct {
	userRepo ports.UserRepository
}

func NewListUsersUseCase(userRepo ports.UserRepository) *ListUsersUseCase {
	return &ListUsersUseCase{userRepo: userRepo}
}

func (uc *ListUsersUseCase) Execute(ctx context.Context, companyID string) ([]*domain.User, error) {
	return uc.userRepo.ListByCompany(ctx, companyID)
}
