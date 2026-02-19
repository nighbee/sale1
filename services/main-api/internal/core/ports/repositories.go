package ports

import (
	"context"
	"github.com/salesai/main-api/internal/core/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, companyID, id string) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
	Delete(ctx context.Context, companyID, id string) error
	ListByCompany(ctx context.Context, companyID string) ([]*domain.User, error)
	AddUserToCompany(ctx context.Context, userID, companyID string, role domain.UserRole) error
	GetUserCompanies(ctx context.Context, userID string) ([]domain.UserCompany, error)
	GetUserTeams(ctx context.Context, userID string) ([]*domain.Team, error)
}

type CompanyRepository interface {
	Create(ctx context.Context, company *domain.Company) error
	GetByID(ctx context.Context, id string) (*domain.Company, error)
	Update(ctx context.Context, company *domain.Company) error
	GetBillingInfo(ctx context.Context, companyID string) (*domain.BillingInfo, error)
	UpdateBillingInfo(ctx context.Context, billing *domain.BillingInfo) error
}

type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
	GetByID(ctx context.Context, companyID, id string) (*domain.Call, error)
	GetByIDInternal(ctx context.Context, id string) (*domain.Call, error)
	ListByCompany(ctx context.Context, companyID string, filters map[string]interface{}) ([]*domain.Call, int, error)
	UpdateStatus(ctx context.Context, id string, status domain.CallStatus) error
}

type TranscriptRepository interface {
	GetByCallID(ctx context.Context, callID string) (*domain.Transcript, error)
	Create(ctx context.Context, transcript *domain.Transcript) error
}

type AnalysisRepository interface {
	GetByCallID(ctx context.Context, callID string) (*domain.AnalysisReport, error)
	Create(ctx context.Context, report *domain.AnalysisReport) error
	GetTeamPerformance(ctx context.Context, companyID string, filters map[string]interface{}) ([]map[string]interface{}, error)
}

type ScriptRepository interface {
	Create(ctx context.Context, script *domain.Script) error
	GetByID(ctx context.Context, companyID, id string) (*domain.Script, error)
	ListByCompany(ctx context.Context, companyID string) ([]*domain.Script, error)
	Update(ctx context.Context, script *domain.Script) error
	Delete(ctx context.Context, companyID, id string) error
	GetActiveByCompany(ctx context.Context, companyID string) (*domain.Script, error)
}

type NotificationRepository interface {
	ListByUser(ctx context.Context, userID string) ([]*domain.Notification, error)
	MarkAsRead(ctx context.Context, userID, id string) error
	Create(ctx context.Context, n *domain.Notification) error
}

type TeamRepository interface {
	Create(ctx context.Context, team *domain.Team) error
	GetByID(ctx context.Context, companyID, id string) (*domain.Team, error)
	ListByCompany(ctx context.Context, companyID string) ([]*domain.Team, error)
	Update(ctx context.Context, team *domain.Team) error
	Delete(ctx context.Context, companyID, id string) error
	AddMember(ctx context.Context, teamID, userID string) error
	RemoveMember(ctx context.Context, teamID, userID string) error
	GetMembers(ctx context.Context, teamID string) ([]*domain.User, error)
}

type IntegrationRepository interface {
	Create(ctx context.Context, integration *domain.Integration) error
	GetByType(ctx context.Context, companyID string, integrationType domain.IntegrationType) (*domain.Integration, error)
	ListByCompany(ctx context.Context, companyID string) ([]*domain.Integration, error)
	Update(ctx context.Context, integration *domain.Integration) error
	Delete(ctx context.Context, companyID string, integrationType domain.IntegrationType) error
}
