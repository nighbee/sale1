package domain

import "time"

type UserRole string

const (
	RoleSuperAdmin  UserRole = "super_admin"
	RoleTenantAdmin UserRole = "tenant_admin"
	RoleSalesRep    UserRole = "sales_rep"
)

type User struct {
	ID              string     `json:"id"`
	CompanyID       string     `json:"company_id"`
	Email           string     `json:"email"`
	PasswordHash    string     `json:"-"`
	InitialPassword *string    `json:"initial_password,omitempty"`
	Role            UserRole   `json:"role"`
	ManagerID    *string    `json:"manager_id,omitempty"`
	ManagerName  string     `json:"manager_name"`
	LineID       *string    `json:"line_id,omitempty"`
	SrcNum       *string    `json:"src_num,omitempty"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Username     string     `json:"username"`
	Phone        string     `json:"phone"`
	IsActive     bool       `json:"is_active"`
	LastLogin    *time.Time `json:"last_login,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
