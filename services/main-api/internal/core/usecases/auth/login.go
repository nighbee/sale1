package auth

import (
	"context"
	"errors"
	"golang.org/x/crypto/bcrypt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	User   *domain.User     `json:"user"`
	Tokens *ports.TokenPair `json:"tokens"`
}

type LoginUseCase struct {
	userRepo   ports.UserRepository
	jwtService ports.JWTService
}

func NewLoginUseCase(userRepo ports.UserRepository, jwtService ports.JWTService) *LoginUseCase {
	return &LoginUseCase{
		userRepo:   userRepo,
		jwtService: jwtService,
	}
}

func (uc *LoginUseCase) Execute(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	user, err := uc.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	tokens, err := uc.jwtService.GenerateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		User:   user,
		Tokens: tokens,
	}, nil
}
