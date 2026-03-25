package scripts

import (
	"context"
	"errors"
	"time"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type BaseScriptUseCase struct {
	scriptRepo ports.ScriptRepository
}

func NewBaseScriptUseCase(scriptRepo ports.ScriptRepository) *BaseScriptUseCase {
	return &BaseScriptUseCase{
		scriptRepo: scriptRepo,
	}
}

func (uc *BaseScriptUseCase) GetActiveBase(ctx context.Context) (*domain.Script, error) {
	return uc.scriptRepo.GetActiveBaseScript(ctx)
}

func (uc *BaseScriptUseCase) GetAllBases(ctx context.Context) ([]*domain.Script, error) {
	return uc.scriptRepo.GetAllBaseScripts(ctx)
}

func (uc *BaseScriptUseCase) ActivateAsBase(ctx context.Context, scriptID string) (*domain.Script, error) {
	script, err := uc.scriptRepo.GetByID(ctx, scriptID)
	if err != nil {
		return nil, errors.New("script not found")
	}

	if !script.IsBaseScript {
		return nil, errors.New("script must be marked as base script first")
	}

	err = uc.scriptRepo.SetActiveBaseScript(ctx, scriptID)
	if err != nil {
		return nil, err
	}

	script.IsActiveBase = true
	return script, nil
}

func (uc *BaseScriptUseCase) CalculateMetrics(ctx context.Context, scriptID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"avg_quality_score": 0,
		"avg_script_match":  0,
		"avg_errors_free":   0,
		"sample_count":      0,
		"last_updated":      time.Now(),
	}, nil
}

func (uc *BaseScriptUseCase) UpdateMetrics(ctx context.Context, scriptID string, metrics map[string]interface{}) error {
	metrics["last_updated"] = time.Now()
	return uc.scriptRepo.UpdateBaseScriptMetrics(ctx, scriptID, metrics)
}
