package domain

import (
	"encoding/json"
	"time"
)

type TranscriptSegment struct {
	Start   float64 `json:"start"`
	End     float64 `json:"end"`
	Speaker string  `json:"speaker"`
	Text    string  `json:"text"`
}

type TranscriptSegments []TranscriptSegment

func (s *TranscriptSegments) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	return json.Unmarshal(value.([]byte), s)
}

type Transcript struct {
	ID                    string             `json:"id"`
	CallID                string             `json:"call_id"`
	SpeakerDiarizedJSON   TranscriptSegments `json:"speaker_diarized_json"`
	STTProvider           string             `json:"stt_provider"`
	ProcessingTimeSeconds int             `json:"processing_time_seconds"`
	ProcessedAt           time.Time       `json:"processed_at"`
}
