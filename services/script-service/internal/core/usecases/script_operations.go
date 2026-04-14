package usecases

import (
	"context"
	"io"

	"github.com/salesai/script-service/internal/core/domain"
	"github.com/salesai/script-service/internal/core/ports"
)

type ScriptOperationsUseCase struct {
	repo    ports.ScriptRepository
	storage ports.Storage
}

func NewScriptOperationsUseCase(repo ports.ScriptRepository, storage ports.Storage) *ScriptOperationsUseCase {
	return &ScriptOperationsUseCase{
		repo:    repo,
		storage: storage,
	}
}

func (uc *ScriptOperationsUseCase) ListScripts(ctx context.Context, companyID string) ([]*domain.Script, error) {
	return uc.repo.List(ctx, companyID)
}

func (uc *ScriptOperationsUseCase) DeleteScript(ctx context.Context, id string, companyID string) error {
	script, err := uc.repo.GetByID(ctx, id, companyID)
	if err != nil {
		return err
	}

	// Soft delete in DB
	if err := uc.repo.Delete(ctx, id, companyID); err != nil {
		return err
	}

	// Physical delete from storage (async is okay but for now simple)
	return uc.storage.Delete(ctx, "scripts", script.FilePathMinio)
}

func (uc *ScriptOperationsUseCase) GetScriptDetails(ctx context.Context, id string, companyID string) (*domain.Script, error) {
	return uc.repo.GetByID(ctx, id, companyID)
}

func (uc *ScriptOperationsUseCase) DownloadScript(ctx context.Context, id string, companyID string) (io.ReadCloser, string, error) {
	script, err := uc.repo.GetByID(ctx, id, companyID)
	if err != nil {
		return nil, "", err
	}

	stream, err := uc.storage.GetStream(ctx, "scripts", script.FilePathMinio)
	return stream, script.Name, err
}
