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

func (uc *TeamPerformanceUseCase) Execute(ctx context.Context, companyID string, filters map[string]interface{}) ([]map[string]interface{}, error) {
	if companyID != "" {
		filters["company_id"] = companyID
	}
	return uc.analysisRepo.GetTeamPerformance(ctx, filters)
}
