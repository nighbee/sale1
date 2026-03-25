package domain

import (
	"time"
)

type Script struct {
	ID                string                 `json:"id"`
	TeamID            *string                `json:"team_id,omitempty"`
	Name              string                 `json:"name"`
	FilePathMinio     string                 `json:"file_path_minio"`
	ParsedText        string                 `json:"parsed_text"`
	Structure         map[string]interface{} `json:"structure"`
	Version           int                    `json:"version"`
	IsActive          bool                   `json:"is_active"`
	IsBaseScript      bool                   `json:"is_base_script"`
	IsActiveBase      bool                   `json:"is_active_base"`
	BaseScriptMetrics map[string]interface{} `json:"base_script_metrics,omitempty"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}
