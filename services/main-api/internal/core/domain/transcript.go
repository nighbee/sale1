package domain

import (
	"encoding/json"
	"time"
)

type Transcript struct {
	ID                    string          `json:"id"`
	CallID                string          `json:"call_id"`
	SpeakerDiarizedJSON   json.RawMessage `json:"speaker_diarized_json"`
	STTProvider           string          `json:"stt_provider"`
	ProcessingTimeSeconds int             `json:"processing_time_seconds"`
	ProcessedAt           time.Time       `json:"processed_at"`
}
