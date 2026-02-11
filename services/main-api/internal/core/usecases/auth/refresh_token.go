package auth

import (
	"context"
	"errors"
	"github.com/salesai/main-api/internal/core/ports"
)

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshTokenUseCase struct {
	userRepo   ports.UserRepository
	jwtService ports.JWTService
}

func NewRefreshTokenUseCase(userRepo ports.UserRepository, jwtService ports.JWTService) *RefreshTokenUseCase {
	return &RefreshTokenUseCase{
		userRepo:   userRepo,
		jwtService: jwtService,
	}
}

func (uc *RefreshTokenUseCase) Execute(ctx context.Context, req RefreshTokenRequest) (*ports.TokenPair, error) {
	claims, err := uc.jwtService.ValidateToken(req.RefreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	userID := claims["user_id"].(string)
	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	return uc.jwtService.GenerateTokenPair(user)
}
