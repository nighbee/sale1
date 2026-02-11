package calls

import (
	"context"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type GetCallDetailsUseCase struct {
	callRepo       ports.CallRepository
	transcriptRepo ports.TranscriptRepository
	analysisRepo   ports.AnalysisRepository
}

func NewGetCallDetailsUseCase(
	callRepo ports.CallRepository,
	transcriptRepo ports.TranscriptRepository,
	analysisRepo ports.AnalysisRepository,
) *GetCallDetailsUseCase {
	return &GetCallDetailsUseCase{
		callRepo:       callRepo,
		transcriptRepo: transcriptRepo,
		analysisRepo:   analysisRepo,
	}
}

func (uc *GetCallDetailsUseCase) GetTranscript(ctx context.Context, callID string) (*domain.Transcript, error) {
	return uc.transcriptRepo.GetByCallID(ctx, callID)
}

func (uc *GetCallDetailsUseCase) GetAnalysis(ctx context.Context, callID string) (*domain.AnalysisReport, error) {
	return uc.analysisRepo.GetByCallID(ctx, callID)
}
