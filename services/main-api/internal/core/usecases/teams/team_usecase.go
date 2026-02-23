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
	users, _ := uc.userRepo.ListByCompany(ctx, companyID)
	for _, u := range users {
		if u.TeamID != nil && *u.TeamID == id {
			team.Members = append(team.Members, u)
		}
	}

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
	user, err := uc.userRepo.GetByID(ctx, companyID, userID)
	if err != nil {
		return err
	}
	user.TeamID = &teamID
	return uc.userRepo.Update(ctx, user)
}

func (uc *TeamUseCase) RemoveMember(ctx context.Context, companyID, teamID, userID string) error {
	user, err := uc.userRepo.GetByID(ctx, companyID, userID)
	if err != nil {
		return err
	}
	if user.TeamID != nil && *user.TeamID == teamID {
		user.TeamID = nil
		return uc.userRepo.Update(ctx, user)
	}
	return nil
}

func (uc *TeamUseCase) Delete(ctx context.Context, companyID, id string) error {
	return uc.teamRepo.Delete(ctx, companyID, id)
}

func (uc *TeamUseCase) EnsureTeamExists(ctx context.Context, teamName, description string) (*domain.Team, error) {
	existing, err := uc.teamRepo.GetByName(ctx, teamName)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	team := &domain.Team{
		ID:          uuid.New().String(),
		CompanyID:   "",
		Name:        teamName,
		Description: description,
		AutoAssign:  false,
	}
	err = uc.teamRepo.Create(ctx, team)
	return team, err
}

func (uc *TeamUseCase) AddMultipleMembers(ctx context.Context, teamID string, userIDs []string) (int, int, error) {
	var membersAdded int
	var alreadyInTeam int

	for _, userID := range userIDs {
		user, err := uc.userRepo.GetByIDGlobal(ctx, userID)
		if err != nil {
			continue
		}

		if user.TeamID != nil && *user.TeamID == teamID {
			alreadyInTeam++
		} else {
			user.TeamID = &teamID
			if err := uc.userRepo.Update(ctx, user); err == nil {
				membersAdded++
			}
		}
	}

	return membersAdded, alreadyInTeam, nil
}
