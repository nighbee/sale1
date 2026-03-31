package calls

import (
	"context"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type ListCallsRequest struct {
	ManagerID   string `json:"manager_id"`
	ManagerName string `json:"manager_name"`
	ClientPhone string `json:"client_phone"`
	TeamID      string `json:"team_id"`
	Status      string `json:"status"`
	Source      string `json:"source"`
	DateFrom    string `json:"date_from"`
	DateTo      string `json:"date_to"`
	Page        int    `json:"page"`
	Limit       int    `json:"limit"`
}

type ListCallsResponse struct {
	Calls        []*domain.Call `json:"calls"`
	Total        int            `json:"total"`
	Page         int            `json:"page"`
	Limit        int            `json:"limit"`
	StatusCounts map[string]int `json:"status_counts"`
}

type ListCallsUseCase struct {
	callRepo ports.CallRepository
}

func NewListCallsUseCase(callRepo ports.CallRepository) *ListCallsUseCase {
	return &ListCallsUseCase{callRepo: callRepo}
}

func (uc *ListCallsUseCase) Execute(ctx context.Context, req ListCallsRequest) (*ListCallsResponse, error) {
	filters := map[string]interface{}{
		"manager_id":   req.ManagerID,
		"manager_name": req.ManagerName,
		"client_phone": req.ClientPhone,
		"team_id":      req.TeamID,
		"status":       req.Status,
		"source":       req.Source,
		"date_from":    req.DateFrom,
		"date_to":      req.DateTo,
		"page":         req.Page,
		"limit":        req.Limit,
	}

	calls, total, statusCounts, err := uc.callRepo.List(ctx, filters)
	if err != nil {
		return nil, err
	}

	return &ListCallsResponse{
		Calls:        calls,
		Total:        total,
		Page:         req.Page,
		Limit:        req.Limit,
		StatusCounts: statusCounts,
	}, nil
}
