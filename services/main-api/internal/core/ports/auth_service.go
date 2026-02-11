package ports

import (
	"github.com/salesai/main-api/internal/core/domain"
)

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type JWTService interface {
	GenerateTokenPair(user *domain.User) (*TokenPair, error)
	ValidateToken(token string) (map[string]interface{}, error)
}
