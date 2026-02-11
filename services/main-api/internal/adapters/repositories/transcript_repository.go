package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
)

type transcriptRepository struct {
	db *sql.DB
}

func NewTranscriptRepository(db *sql.DB) *transcriptRepository {
	return &transcriptRepository{db: db}
}

func (r *transcriptRepository) GetByCallID(ctx context.Context, callID string) (*domain.Transcript, error) {
	query := `
		SELECT id, call_id, speaker_diarized_json, stt_provider, processing_time_seconds, processed_at
		FROM calls_schema.transcripts
		WHERE call_id = $1
	`

	t := &domain.Transcript{}
	err := r.db.QueryRowContext(ctx, query, callID).Scan(
		&t.ID,
		&t.CallID,
		&t.SpeakerDiarizedJSON,
		&t.STTProvider,
		&t.ProcessingTimeSeconds,
		&t.ProcessedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("transcript not found")
	}

	return t, err
}
