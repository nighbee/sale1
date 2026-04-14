package usecases

import (
	"context"
	"fmt"
	"os/exec"

	"github.com/google/uuid"
	"github.com/salesai/script-service/internal/core/domain"
	"github.com/salesai/script-service/internal/core/ports"
)

type UploadScriptRequest struct {
	Name      string
	CompanyID string
	TeamID    *string
	FilePath  string
	Extension string
}

type UploadScriptUseCase struct {
	repo    ports.ScriptRepository
	storage ports.Storage
}

func NewUploadScriptUseCase(repo ports.ScriptRepository, storage ports.Storage) *UploadScriptUseCase {
	return &UploadScriptUseCase{
		repo:    repo,
		storage: storage,
	}
}

func (uc *UploadScriptUseCase) Execute(ctx context.Context, req UploadScriptRequest) (string, error) {
	scriptID := uuid.New().String()
	objectName := fmt.Sprintf("scripts/%s%s", scriptID, req.Extension)

	// Parse with Python
	var parser string
	if req.Extension == ".docx" {
		parser = "./scripts/parse_docx.py"
	} else if req.Extension == ".pdf" {
		parser = "./scripts/parse_pdf.py"
	} else {
		return "", fmt.Errorf("unsupported file type: %s", req.Extension)
	}

	cmd := exec.Command("python3", parser, req.FilePath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to parse document: %w, output: %s", err, string(out))
	}
	parsedText := string(out)

	bucketName := "scripts"
	exists, err := uc.storage.BucketExists(ctx, bucketName)
	if err != nil {
		return "", fmt.Errorf("failed to check bucket: %w", err)
	}
	if !exists {
		if err := uc.storage.MakeBucket(ctx, bucketName); err != nil {
			return "", fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	if err := uc.storage.Upload(ctx, bucketName, objectName, req.FilePath); err != nil {
		return "", fmt.Errorf("failed to upload to storage: %w", err)
	}

	script := &domain.Script{
		ID:             scriptID,
		CompanyID:      req.CompanyID,
		Name:           req.Name,
		FilePathMinio: objectName,
		ParsedText:     parsedText,
		TeamID:         req.TeamID,
		IsActive:       true,
		Version:        1,
	}

	if err := uc.repo.Create(ctx, script); err != nil {
		return "", fmt.Errorf("failed to save to database: %w", err)
	}

	return scriptID, nil
}
