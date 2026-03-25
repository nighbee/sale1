package analytics

import (
	"context"
	"github.com/salesai/main-api/internal/core/ports"
)

type TeamPerformanceUseCase struct {
	analysisRepo ports.AnalysisRepository
}

func NewTeamPerformanceUseCase(analysisRepo ports.AnalysisRepository) *TeamPerformanceUseCase {
	return &TeamPerformanceUseCase{analysisRepo: analysisRepo}
}

func (uc *TeamPerformanceUseCase) Execute(ctx context.Context, filters map[string]interface{}) ([]map[string]interface{}, error) {
	return uc.analysisRepo.GetTeamPerformance(ctx, filters)
}
