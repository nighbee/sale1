package teams

import (
	"context"
	"github.com/google/uuid"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type TeamUseCase struct {
	teamRepo   ports.TeamRepository
	userRepo   ports.UserRepository
	scriptRepo ports.ScriptRepository
}

func NewTeamUseCase(
	teamRepo ports.TeamRepository,
	userRepo ports.UserRepository,
	scriptRepo ports.ScriptRepository,
) *TeamUseCase {
	return &TeamUseCase{
		teamRepo:   teamRepo,
		userRepo:   userRepo,
		scriptRepo: scriptRepo,
	}
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
	team, err := uc.teamRepo.GetByID(ctx, companyID, id)
	if err != nil {
		return nil, err
	}

	// Fetch members
	members, _ := uc.teamRepo.GetMembers(ctx, id)
	team.Members = members

	// Fetch script - we need a way to get script by team_id
	// I'll add GetByTeamID to scriptRepo
	scripts, _ := uc.scriptRepo.ListByCompany(ctx, companyID)
	for _, s := range scripts {
		if s.TeamID != nil && *s.TeamID == id {
			team.Script = s
			break
		}
	}

	return team, nil
}

func (uc *TeamUseCase) ListByCompany(ctx context.Context, companyID string) ([]*domain.Team, error) {
	return uc.teamRepo.ListByCompany(ctx, companyID)
}

func (uc *TeamUseCase) Update(ctx context.Context, team *domain.Team) error {
	return uc.teamRepo.Update(ctx, team)
}

func (uc *TeamUseCase) AddMember(ctx context.Context, companyID, teamID, userID string) error {
	// Verify user belongs to company
	_, err := uc.userRepo.GetByID(ctx, companyID, userID)
	if err != nil {
		return err
	}
	return uc.teamRepo.AddMember(ctx, teamID, userID)
}

func (uc *TeamUseCase) RemoveMember(ctx context.Context, companyID, teamID, userID string) error {
	// Verify user belongs to company
	_, err := uc.userRepo.GetByID(ctx, companyID, userID)
	if err != nil {
		return err
	}
	return uc.teamRepo.RemoveMember(ctx, teamID, userID)
}

func (uc *TeamUseCase) Delete(ctx context.Context, companyID, id string) error {
	return uc.teamRepo.Delete(ctx, companyID, id)
}
