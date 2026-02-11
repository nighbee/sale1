package security

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type jwtService struct {
	secret string
	expiry time.Duration
}

func NewJWTService(secret string, expiry time.Duration) ports.JWTService {
	return &jwtService{
		secret: secret,
		expiry: expiry,
	}
}

type CustomClaims struct {
	UserID    string `json:"user_id"`
	CompanyID string `json:"company_id"`
	Role      string `json:"role"`
	Email     string `json:"email"`
	jwt.RegisteredClaims
}

func (s *jwtService) GenerateTokenPair(user *domain.User) (*ports.TokenPair, error) {
	claims := CustomClaims{
		UserID:    user.ID,
		CompanyID: user.CompanyID,
		Role:      string(user.Role),
		Email:     user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(s.secret))
	if err != nil {
		return nil, err
	}

	// For simplicity in this implementation, refresh token is just another token with longer expiry
	refreshClaims := claims
	refreshClaims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(s.expiry * 24))
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(s.secret))
	if err != nil {
		return nil, err
	}

	return &ports.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int(s.expiry.Seconds()),
	}, nil
}

func (s *jwtService) ValidateToken(tokenString string) (map[string]interface{}, error) {
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.secret), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}

	return map[string]interface{}{
		"user_id":    claims.UserID,
		"company_id": claims.CompanyID,
		"role":       claims.Role,
		"email":      claims.Email,
	}, nil
}
