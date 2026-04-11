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

func (uc *TeamUseCase) Create(ctx context.Context, companyID, name, description string, autoAssign bool) (*domain.Team, error) {
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

func (uc *TeamUseCase) GetByID(ctx context.Context, id string, companyID string) (*domain.Team, error) {
	team, err := uc.teamRepo.GetByID(ctx, id, companyID)
	if err != nil {
		return nil, err
	}

	// Fetch members
	users, _ := uc.userRepo.List(ctx, companyID)
	for _, u := range users {
		if u.TeamID != nil && *u.TeamID == id {
			team.Members = append(team.Members, u)
		}
	}

	// Fetch script
	scripts, _ := uc.scriptRepo.List(ctx, companyID)
	for _, s := range scripts {
		if s.TeamID != nil && *s.TeamID == id {
			team.Script = s
			break
		}
	}

	return team, nil
}

func (uc *TeamUseCase) List(ctx context.Context, companyID string) ([]*domain.Team, error) {
	return uc.teamRepo.List(ctx, companyID)
}

func (uc *TeamUseCase) ListAll(ctx context.Context, filters map[string]interface{}) ([]*domain.Team, int, error) {
	return uc.teamRepo.ListAll(ctx, filters)
}

func (uc *TeamUseCase) Update(ctx context.Context, team *domain.Team) error {
	return uc.teamRepo.Update(ctx, team)
}

func (uc *TeamUseCase) AddMember(ctx context.Context, teamID, userID, companyID string) error {
	// First ensure team belongs to company
	_, err := uc.teamRepo.GetByID(ctx, teamID, companyID)
	if err != nil {
		return err
	}

	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	// Ensure user belongs to same company
	if user.CompanyID != companyID {
		return context.DeadlineExceeded // Or another appropriate error
	}

	user.TeamID = &teamID
	return uc.userRepo.Update(ctx, user)
}

func (uc *TeamUseCase) RemoveMember(ctx context.Context, teamID, userID, companyID string) error {
	// First ensure team belongs to company
	_, err := uc.teamRepo.GetByID(ctx, teamID, companyID)
	if err != nil {
		return err
	}

	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	// Ensure user belongs to same company
	if user.CompanyID != companyID {
		return context.DeadlineExceeded
	}

	if user.TeamID != nil && *user.TeamID == teamID {
		user.TeamID = nil
		return uc.userRepo.Update(ctx, user)
	}
	return nil
}

func (uc *TeamUseCase) Delete(ctx context.Context, id string, companyID string) error {
	return uc.teamRepo.Delete(ctx, id, companyID)
}

func (uc *TeamUseCase) EnsureTeamExists(ctx context.Context, companyID, teamName, description string) (*domain.Team, error) {
	existing, err := uc.teamRepo.GetByName(ctx, teamName, companyID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	team := &domain.Team{
		ID:          uuid.New().String(),
		CompanyID:   companyID,
		Name:        teamName,
		Description: description,
		AutoAssign:  false,
	}
	err = uc.teamRepo.Create(ctx, team)
	return team, err
}

func (uc *TeamUseCase) AddMultipleMembers(ctx context.Context, teamID string, userIDs []string, companyID string) (int, int, error) {
	// First ensure team belongs to company
	_, err := uc.teamRepo.GetByID(ctx, teamID, companyID)
	if err != nil {
		return 0, 0, err
	}

	var membersAdded int
	var alreadyInTeam int

	for _, userID := range userIDs {
		user, err := uc.userRepo.GetByID(ctx, userID)
		if err != nil {
			continue
		}

		// Ensure user belongs to same company
		if user.CompanyID != companyID {
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
