package domain

import "time"

type Team struct {
	ID          string    `json:"id"`
	CompanyID   string    `json:"company_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	AutoAssign  bool      `json:"auto_assign"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Members     []*User   `json:"members,omitempty"`
	Script      *Script   `json:"script,omitempty"`
}
