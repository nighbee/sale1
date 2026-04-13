package calls

import (
	"context"
	"fmt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type ClearTenantQueueUseCase struct {
	callRepo  ports.CallRepository
	publisher ports.QueuePublisher
}

func NewClearTenantQueueUseCase(callRepo ports.CallRepository, publisher ports.QueuePublisher) *ClearTenantQueueUseCase {
	return &ClearTenantQueueUseCase{
		callRepo:  callRepo,
		publisher: publisher,
	}
}

func (uc *ClearTenantQueueUseCase) Execute(ctx context.Context, companyID string) error {
	// 1. Mark all pending/processing calls for this company as 'error' or 'cancelled'
	// Note: currently we don't have StatusCancelled in domain.CallStatus, using StatusError for now or we could add it.
	filters := map[string]interface{}{
		"current_status": string(domain.StatusPending),
	}
	err := uc.callRepo.UpdateStatusByFilter(ctx, companyID, filters, domain.StatusError)
	if err != nil {
		return fmt.Errorf("failed to update status in DB: %w", err)
	}

	// 2. Remove items from Redis
	items, err := uc.publisher.GetQueueItems(ctx, companyID)
	if err != nil {
		return fmt.Errorf("failed to get queue items: %w", err)
	}

	for _, item := range items {
		raw, _ := item["raw"].(string)
		if raw != "" {
			uc.publisher.DeleteQueueItem(ctx, companyID, raw)
		}
	}

	return nil
}
