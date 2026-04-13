package calls

import (
	"context"
	"fmt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type BulkReprocessUseCase struct {
	callRepo  ports.CallRepository
	publisher ports.QueuePublisher
}

func NewBulkReprocessUseCase(callRepo ports.CallRepository, publisher ports.QueuePublisher) *BulkReprocessUseCase {
	return &BulkReprocessUseCase{
		callRepo:  callRepo,
		publisher: publisher,
	}
}

func (uc *BulkReprocessUseCase) Execute(ctx context.Context, companyID string, dateFrom, dateTo string) error {
	// 1. Get all calls in range for this company that need processing (e.g. status != completed)
	filters := map[string]interface{}{
		"company_id": companyID,
		"date_from":  dateFrom,
		"date_to":    dateTo,
		"limit":      1000, // Batch limit for safety
	}

	calls, _, _, err := uc.callRepo.List(ctx, filters)
	if err != nil {
		return fmt.Errorf("failed to list calls for bulk reprocess: %w", err)
	}

	for _, call := range calls {
		// Only reprocess if not already processing
		if call.Status == domain.StatusProcessing {
			continue
		}

		// Update status to pending
		err = uc.callRepo.UpdateStatus(ctx, call.ID, domain.StatusPending)
		if err != nil {
			continue // Log and continue
		}

		// Enqueue
		uc.publisher.EnqueueAudioProcessing(ctx, call.ID, call.CallLink, call.ManagerID, call.CompanyID)
	}

	return nil
}
