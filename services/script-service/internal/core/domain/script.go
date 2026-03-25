package domain

import "time"

type Script struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	FilePathMinio string     `json:"file_path_minio"`
	ParsedText     string     `json:"parsed_text"`
	Structure      string     `json:"structure"`
	Version        int        `json:"version"`
	IsActive       bool       `json:"is_active"`
	TeamID         *string    `json:"team_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
