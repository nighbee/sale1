package ports

import (
	"github.com/salesai/main-api/internal/core/domain"
)

// TokenPair represents a pair of access and refresh JWT tokens.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// JWTService defines the contract for generating and validating JSON Web Tokens.
type JWTService interface {
	// GenerateTokenPair creates a new pair of access and refresh tokens for a given user.
	GenerateTokenPair(user *domain.User) (*TokenPair, error)
	// ValidateToken parses and validates a JWT string, returning the claims if successful.
	ValidateToken(token string) (map[string]interface{}, error)
}
