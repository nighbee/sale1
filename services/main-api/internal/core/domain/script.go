package domain

import (
	"encoding/json"
	"time"
)

type Script struct {
	ID            string          `json:"id"`
	CompanyID     string          `json:"company_id"`
	Name          string          `json:"name"`
	FilePathMinio string          `json:"file_path_minio"`
	ParsedText    string          `json:"parsed_text"`
	Definition    json.RawMessage `json:"definition,omitempty"`
	Version       int             `json:"version"`
	IsActive      bool            `json:"is_active"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}
