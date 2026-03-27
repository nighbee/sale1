package calls

import (
	"context"
	"fmt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type ReprocessCallUseCase struct {
	callRepo  ports.CallRepository
	publisher ports.QueuePublisher
}

func NewReprocessCallUseCase(callRepo ports.CallRepository, publisher ports.QueuePublisher) *ReprocessCallUseCase {
	return &ReprocessCallUseCase{
		callRepo:  callRepo,
		publisher: publisher,
	}
}

func (uc *ReprocessCallUseCase) Execute(ctx context.Context, callID string) error {
	call, err := uc.callRepo.GetByID(ctx, callID)
	if err != nil {
		return fmt.Errorf("failed to get call: %w", err)
	}

	// Update status to pending
	err = uc.callRepo.UpdateStatus(ctx, callID, domain.StatusPending)
	if err != nil {
		return fmt.Errorf("failed to update call status: %w", err)
	}

	// Enqueue job
	err = uc.publisher.EnqueueAudioProcessing(ctx, call.ID, call.CallLink, call.ManagerID)
	if err != nil {
		return fmt.Errorf("failed to enqueue audio processing: %w", err)
	}

	return nil
}
