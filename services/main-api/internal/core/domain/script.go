package domain

import (
	"time"
)

type Script struct {
	ID             string                 `json:"id"`
	CompanyID      string                 `json:"company_id"`
	Name           string                 `json:"name"`
	FilePathMinio  string                 `json:"file_path_minio"`
	ParsedText     string                 `json:"parsed_text"`
	Structure      map[string]interface{} `json:"structure"`
	Version        int                    `json:"version"`
	IsActive       bool                   `json:"is_active"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}
