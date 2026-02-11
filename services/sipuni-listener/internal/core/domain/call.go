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
	ID           string     `json:"id"`
	CompanyID    string     `json:"company_id"`
	ManagerID    string     `json:"manager_id"`
	ManagerName  string     `json:"manager_name"`
	ClientPhone  string     `json:"client_phone"`
	ClientID     *string    `json:"client_id,omitempty"`
	Duration     int        `json:"duration"`
	CallLink     string     `json:"call_link"`
	ChatLink     *string    `json:"chat_link,omitempty"`
	CallDate     time.Time  `json:"call_date"`
	CallTime     time.Time  `json:"call_time"`
	Status       CallStatus `json:"status"`
	Source       string     `json:"source"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
