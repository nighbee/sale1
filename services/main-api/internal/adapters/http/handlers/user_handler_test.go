package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/usecases/calls"
)

type mockUserRepo struct {
	user *domain.User
	err  error
}

func (m *mockUserRepo) Create(ctx context.Context, u *domain.User) error { return nil }
func (m *mockUserRepo) GetByID(ctx context.Context, id string) (*domain.User, error) {
	return m.user, m.err
}
func (m *mockUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) { return nil, nil }
func (m *mockUserRepo) GetByPhone(ctx context.Context, phone string) (*domain.User, error) { return nil, nil }
func (m *mockUserRepo) Update(ctx context.Context, u *domain.User) error                { return nil }
func (m *mockUserRepo) Delete(ctx context.Context, id string) error                    { return nil }
func (m *mockUserRepo) List(ctx context.Context) ([]*domain.User, error) {
	return nil, nil
}
func (m *mockUserRepo) GetByManagerID(ctx context.Context, managerID string) (*domain.User, error) {
	return nil, nil
}

type mockCallRepo struct {
	calls []*domain.Call
	total int
	err   error
}

func (m *mockCallRepo) Create(ctx context.Context, c *domain.Call) error { return nil }
func (m *mockCallRepo) GetByID(ctx context.Context, id string) (*domain.Call, error) { return nil, nil }
func (m *mockCallRepo) GetByIDInternal(ctx context.Context, id string) (*domain.Call, error) {
	return nil, nil
}
func (m *mockCallRepo) List(ctx context.Context, filters map[string]interface{}) ([]*domain.Call, int, map[string]int, error) {
	return m.calls, m.total, nil, m.err
}
func (m *mockCallRepo) UpdateStatus(ctx context.Context, id string, status domain.CallStatus) error {
	return nil
}

func TestGetUserCalls_Auth(t *testing.T) {
	app := fiber.New()

	managerID := "manager-1"
	mockUser := &domain.User{
		ID:        "user-1",
		ManagerID: &managerID,
		Role:      domain.RoleSalesRep,
	}

	callRepo := &mockCallRepo{
		calls: []*domain.Call{{ID: "call-1", ManagerID: managerID}},
		total: 1,
	}
	listCallsUC := calls.NewListCallsUseCase(callRepo)

	h := NewUserHandler(&mockUserRepo{user: mockUser}, listCallsUC)

	app.Get("/users/:id/calls", func(c *fiber.Ctx) error {
		// Mock locals for auth
		c.Locals("user_id", "user-2") // Different user
		c.Locals("role", string(domain.RoleSalesRep))
		return h.GetUserCalls(c)
	})

	req := httptest.NewRequest("GET", "/users/user-1/calls", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 403 {
		t.Errorf("expected status 403 for unauthorized access, got %d", resp.StatusCode)
	}
}

func TestGetUserCalls_Success(t *testing.T) {
	app := fiber.New()

	managerID := "manager-1"
	mockUser := &domain.User{
		ID:        "user-1",
		ManagerID: &managerID,
		Role:      domain.RoleSalesRep,
	}

	callRepo := &mockCallRepo{
		calls: []*domain.Call{{ID: "call-1", ManagerID: managerID}},
		total: 1,
	}
	listCallsUC := calls.NewListCallsUseCase(callRepo)

	h := NewUserHandler(&mockUserRepo{user: mockUser}, listCallsUC)

	app.Get("/users/:id/calls", func(c *fiber.Ctx) error {
		// Mock locals for auth
		c.Locals("user_id", "user-1") // Same user
		c.Locals("role", string(domain.RoleSalesRep))
		return h.GetUserCalls(c)
	})

	req := httptest.NewRequest("GET", "/users/user-1/calls", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var result calls.ListCallsResponse
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Total != 1 {
		t.Errorf("expected 1 call, got %d", result.Total)
	}
	if result.Calls[0].ID != "call-1" {
		t.Errorf("expected call-1, got %s", result.Calls[0].ID)
	}
}

func TestGetUserCalls_ManagerAccess(t *testing.T) {
	app := fiber.New()

	managerID := "manager-1"
	mockUser := &domain.User{
		ID:        "user-1",
		ManagerID: &managerID,
		Role:      domain.RoleSalesRep,
	}

	callRepo := &mockCallRepo{
		calls: []*domain.Call{{ID: "call-1", ManagerID: managerID}},
		total: 1,
	}
	listCallsUC := calls.NewListCallsUseCase(callRepo)

	h := NewUserHandler(&mockUserRepo{user: mockUser}, listCallsUC)

	app.Get("/users/:id/calls", func(c *fiber.Ctx) error {
		// Mock locals for auth: requester is the manager
		c.Locals("user_id", managerID)
		c.Locals("role", string(domain.RoleSalesRep))
		return h.GetUserCalls(c)
	})

	req := httptest.NewRequest("GET", "/users/user-1/calls", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200 for manager access, got %d", resp.StatusCode)
	}
}
