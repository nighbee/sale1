package auth

import (
	"context"
	"errors"
	"github.com/salesai/main-api/internal/core/ports"
)

type RefreshUseCase struct {
	userRepo   ports.UserRepository
	jwtService ports.JWTService
}

func NewRefreshUseCase(userRepo ports.UserRepository, jwtService ports.JWTService) *RefreshUseCase {
	return &RefreshUseCase{
		userRepo:   userRepo,
		jwtService: jwtService,
	}
}

func (uc *RefreshUseCase) Execute(ctx context.Context, refreshToken string) (*ports.TokenPair, error) {
	claims, err := uc.jwtService.ValidateToken(refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	userID := claims["user_id"].(string)
	companyID := claims["company_id"].(string)
	user, err := uc.userRepo.GetByID(ctx, companyID, userID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	return uc.jwtService.GenerateTokenPair(user)
}
