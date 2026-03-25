package domain

import "time"

type UserRole string

const (
	RoleSuperAdmin  UserRole = "super_admin"
	RoleTenantAdmin UserRole = "tenant_admin"
	RoleSalesRep    UserRole = "sales_rep"
)

type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Role         UserRole   `json:"role"`
	ManagerID    *string    `json:"manager_id,omitempty"`
	ManagerName  string     `json:"manager_name"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	IsActive     bool       `json:"is_active"`
	LastLogin    *time.Time `json:"last_login,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
