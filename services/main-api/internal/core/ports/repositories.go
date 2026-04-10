package ports

import (
	"context"

	"github.com/salesai/main-api/internal/core/domain"
)

// UserRepository defines the contract for user-related data operations.
type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id string) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByPhone(ctx context.Context, phone string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, companyID string) ([]*domain.User, error)
	GetByManagerID(ctx context.Context, managerID string, companyID string) (*domain.User, error)
	GetBySrcNum(ctx context.Context, srcNum string, companyID string) (*domain.User, error)
}

// CompanyRepository defines the contract for company-related data operations.
type CompanyRepository interface {
	Create(ctx context.Context, company *domain.Company) error
	GetByID(ctx context.Context, id string) (*domain.Company, error)
	Update(ctx context.Context, company *domain.Company) error
	GetBillingInfo(ctx context.Context, companyID string) (*domain.BillingInfo, error)
	UpdateBillingInfo(ctx context.Context, billing *domain.BillingInfo) error
}

// CallRepository defines the contract for call recording metadata operations.
type CallRepository interface {
	Create(ctx context.Context, call *domain.Call) error
	GetByID(ctx context.Context, id string) (*domain.Call, error)
	GetByIDInternal(ctx context.Context, id string) (*domain.Call, error)
	List(ctx context.Context, filters map[string]interface{}) ([]*domain.Call, int, map[string]int, error)
	UpdateStatus(ctx context.Context, id string, status domain.CallStatus) error
}

// TranscriptRepository defines the contract for call transcript storage.
type TranscriptRepository interface {
	GetByCallID(ctx context.Context, callID string) (*domain.Transcript, error)
	Create(ctx context.Context, transcript *domain.Transcript) error
}

// AnalysisRepository defines the contract for AI analysis report operations.
type AnalysisRepository interface {
	GetByCallID(ctx context.Context, callID string) (*domain.AnalysisReport, error)
	Create(ctx context.Context, report *domain.AnalysisReport) error
	GetTeamPerformance(ctx context.Context, filters map[string]interface{}) ([]map[string]interface{}, error)
}

// ScriptRepository defines the contract for sales script operations.
type ScriptRepository interface {
	Create(ctx context.Context, script *domain.Script) error
	GetByID(ctx context.Context, id string, companyID string) (*domain.Script, error)
	List(ctx context.Context, companyID string) ([]*domain.Script, error)
	Update(ctx context.Context, script *domain.Script) error
	Delete(ctx context.Context, id string, companyID string) error
	GetActive(ctx context.Context, companyID string) (*domain.Script, error)
	GetActiveBaseScript(ctx context.Context) (*domain.Script, error)
	GetAllBaseScripts(ctx context.Context) ([]*domain.Script, error)
	SetActiveBaseScript(ctx context.Context, scriptID string) error
	UpdateBaseScriptMetrics(ctx context.Context, scriptID string, metrics map[string]interface{}) error
}

// NotificationRepository defines the contract for user notification operations.
type NotificationRepository interface {
	ListByUser(ctx context.Context, userID string) ([]*domain.Notification, error)
	MarkAsRead(ctx context.Context, userID, id string) error
	Create(ctx context.Context, n *domain.Notification) error
}

// TeamRepository defines the contract for sales team/group operations.
type TeamRepository interface {
	Create(ctx context.Context, team *domain.Team) error
	GetByID(ctx context.Context, id string, companyID string) (*domain.Team, error)
	GetByName(ctx context.Context, name string, companyID string) (*domain.Team, error)
	List(ctx context.Context, companyID string) ([]*domain.Team, error)
	Update(ctx context.Context, team *domain.Team) error
	Delete(ctx context.Context, id string, companyID string) error
}

// IntegrationRepository defines the contract for third-party integration settings.
type IntegrationRepository interface {
	Create(ctx context.Context, integration *domain.Integration) error
	GetByType(ctx context.Context, integrationType domain.IntegrationType, companyID string) (*domain.Integration, error)
	List(ctx context.Context, companyID string) ([]*domain.Integration, error)
	ListAllActive(ctx context.Context) ([]*domain.Integration, error)
	Update(ctx context.Context, integration *domain.Integration) error
	Delete(ctx context.Context, integrationType domain.IntegrationType, companyID string) error
}

// AISettingsRepository defines the contract for AI configuration settings.
type AISettingsRepository interface {
	Get(ctx context.Context, companyID string) (*domain.AISettings, error)
	Update(ctx context.Context, settings *domain.AISettings) error
}
