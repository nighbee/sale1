package auth

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type LoginRequest struct {
	// Accept either email or phone for login. Both are optional but password is required.
	Email    string `json:"email"`
	Phone    string `json:"phone"`
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
	var user *domain.User
	var err error

	// prefer email when provided
	if req.Email != "" {
		user, err = uc.userRepo.GetByEmail(ctx, req.Email)
		if err != nil {
			// if not found and phone provided, try phone
			if err.Error() == "user not found" && req.Phone != "" {
				user, err = uc.userRepo.GetByPhone(ctx, req.Phone)
			}
		}
	} else if req.Phone != "" {
		user, err = uc.userRepo.GetByPhone(ctx, req.Phone)
	}

	if err != nil {
		fmt.Printf("User lookup error for login: email=%s phone=%s err=%v\n", req.Email, req.Phone, err)
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
