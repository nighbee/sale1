package teams

import (
	"context"
	"github.com/google/uuid"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type TeamUseCase struct {
	teamRepo ports.TeamRepository
}

func NewTeamUseCase(teamRepo ports.TeamRepository) *TeamUseCase {
	return &TeamUseCase{teamRepo: teamRepo}
}

func (uc *TeamUseCase) Create(ctx context.Context, companyID string, name, description string, autoAssign bool) (*domain.Team, error) {
	team := &domain.Team{
		ID:          uuid.New().String(),
		CompanyID:   companyID,
		Name:        name,
		Description: description,
		AutoAssign:  autoAssign,
	}
	err := uc.teamRepo.Create(ctx, team)
	return team, err
}

func (uc *TeamUseCase) GetByID(ctx context.Context, companyID, id string) (*domain.Team, error) {
	return uc.teamRepo.GetByID(ctx, companyID, id)
}

func (uc *TeamUseCase) ListByCompany(ctx context.Context, companyID string) ([]*domain.Team, error) {
	return uc.teamRepo.ListByCompany(ctx, companyID)
}

func (uc *TeamUseCase) Update(ctx context.Context, team *domain.Team) error {
	return uc.teamRepo.Update(ctx, team)
}

func (uc *TeamUseCase) Delete(ctx context.Context, companyID, id string) error {
	return uc.teamRepo.Delete(ctx, companyID, id)
}
