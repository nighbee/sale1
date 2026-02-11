package ports

import (
	"context"
	"github.com/salesai/main-api/internal/core/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id string) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
	Delete(ctx context.Context, id string) error
	ListByCompany(ctx context.Context, companyID string) ([]*domain.User, error)
}

type CompanyRepository interface {
	Create(ctx context.Context, company *domain.Company) error
	GetByID(ctx context.Context, id string) (*domain.Company, error)
	Update(ctx context.Context, company *domain.Company) error
}

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
	GetByID(ctx context.Context, id string) (*domain.Call, error)
	ListByCompany(ctx context.Context, companyID string, filters map[string]interface{}) ([]*domain.Call, int, error)
	UpdateStatus(ctx context.Context, id string, status domain.CallStatus) error
}

type TranscriptRepository interface {
	GetByCallID(ctx context.Context, callID string) (*domain.Transcript, error)
}

type AnalysisRepository interface {
	GetByCallID(ctx context.Context, callID string) (*domain.AnalysisReport, error)
	GetTeamPerformance(ctx context.Context, companyID string) (interface{}, error)
	GetLeaderboard(ctx context.Context, companyID string) (interface{}, error)
}
