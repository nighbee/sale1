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

func (uc *ScriptOperationsUseCase) DeleteScript(ctx context.Context, id string) error {
	return uc.repo.Delete(ctx, id)
}

func (uc *ScriptOperationsUseCase) DownloadScript(ctx context.Context, id string) (io.ReadCloser, string, error) {
	script, err := uc.repo.GetByID(ctx, id)
	if err != nil {
		return nil, "", err
	}

	stream, err := uc.storage.GetStream(ctx, "scripts", script.FilePathMinio)
	return stream, script.Name, err
}
