package analytics

import (
	"context"
	"github.com/salesai/main-api/internal/core/ports"
)

type GetTrendsUseCase struct {
	analysisRepo ports.AnalysisRepository
}

func NewGetTrendsUseCase(analysisRepo ports.AnalysisRepository) *GetTrendsUseCase {
	return &GetTrendsUseCase{analysisRepo: analysisRepo}
}

func (uc *GetTrendsUseCase) Execute(ctx context.Context, companyID string, filters map[string]interface{}) ([]map[string]interface{}, error) {
	return uc.analysisRepo.GetTrends(ctx, companyID, filters)
}
