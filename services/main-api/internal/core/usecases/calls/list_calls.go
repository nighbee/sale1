package calls

import (
	"context"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type ListCallsRequest struct {
	CompanyID string `json:"company_id"`
	ManagerID string `json:"manager_id"`
	Status    string `json:"status"`
	Page      int    `json:"page"`
	Limit     int    `json:"limit"`
}

type ListCallsResponse struct {
	Calls []*domain.Call `json:"calls"`
	Total int            `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}

type ListCallsUseCase struct {
	callRepo ports.CallRepository
}

func NewListCallsUseCase(callRepo ports.CallRepository) *ListCallsUseCase {
	return &ListCallsUseCase{callRepo: callRepo}
}

func (uc *ListCallsUseCase) Execute(ctx context.Context, req ListCallsRequest) (*ListCallsResponse, error) {
	filters := map[string]interface{}{
		"manager_id": req.ManagerID,
		"status":     req.Status,
		"page":       req.Page,
		"limit":      req.Limit,
	}

	calls, total, err := uc.callRepo.ListByCompany(ctx, req.CompanyID, filters)
	if err != nil {
		return nil, err
	}

	return &ListCallsResponse{
		Calls: calls,
		Total: total,
		Page:  req.Page,
		Limit: req.Limit,
	}, nil
}
