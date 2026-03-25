package domain

import "time"

type CallStatus string

const (
	StatusPending    CallStatus = "pending"
	StatusProcessing CallStatus = "processing"
	StatusCompleted  CallStatus = "completed"
	StatusError      CallStatus = "error"
)

type Call struct {
	ID          string     `json:"id"`
	ManagerID   string     `json:"manager_id"`
	ManagerName string     `json:"manager_name"`
	ClientPhone string     `json:"client_phone"`
	ClientID    *string    `json:"client_id,omitempty"`
	Duration    int        `json:"duration"`
	CallLink    string     `json:"call_link"`
	ChatLink    *string    `json:"chat_link,omitempty"`
	CallDate    time.Time  `json:"call_date"`
	CallTime    time.Time  `json:"call_time"`
	Status      CallStatus `json:"status"`
	Source      string     `json:"source"`
	ExternalID  *string    `json:"external_id,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	// Analysis scores – populated in list queries via LEFT JOIN
	QualityScore *int `json:"quality_score,omitempty"`
	ScriptMatch  *int `json:"script_match,omitempty"`
	ErrorsFree   *int `json:"errors_free,omitempty"`
}
