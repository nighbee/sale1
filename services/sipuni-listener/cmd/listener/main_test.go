package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/salesai/sipuni-listener/internal/adapters/queue"
	"github.com/salesai/sipuni-listener/internal/core/domain"
	applogger "github.com/salesai/sipuni-listener/internal/infrastructure/logger"
)

type MockCallRepository struct {
	Calls []*domain.Call
}

func (m *MockCallRepository) Create(ctx context.Context, call *domain.Call) error {
	m.Calls = append(m.Calls, call)
	return nil
}

type MockUserRepository struct {
	Users map[string]string
}

func (m *MockUserRepository) EnsureManagerUser(ctx context.Context, managerID, managerName string) (string, error) {
	if m.Users == nil {
		m.Users = make(map[string]string)
	}
	m.Users[managerID] = "mock_user_id_" + managerID
	return m.Users[managerID], nil
}

type MockPublisher struct {
	Jobs []queue.AudioProcessingJob
}

func (m *MockPublisher) EnqueueAudioProcessing(ctx context.Context, job queue.AudioProcessingJob) error {
	m.Jobs = append(m.Jobs, job)
	return nil
}

func TestHandleNotify(t *testing.T) {
	// Initialize logger to avoid nil pointer dereference
	applogger.Init("sipuni-listener-test")

	mockCallRepo := &MockCallRepository{}
	mockUserRepo := &MockUserRepository{}
	mockPublisher := &MockPublisher{}

	// Set global variables used in main.go
	callRepo = mockCallRepo
	userRepo = mockUserRepo
	publisher = mockPublisher

	now := time.Now().Unix()
	start := now - 60
	answer := now - 50

	// Mock Sipuni notification request
	notifyReq := SipuniNotifyRequest{
		CallID: "sipuni_call_123",
		Event:  json.Number("2"),
		DstNum: "79001112233",
		SrcNum: "101",
		SrcType: 0, // internal
		DstType: 1, // external (outbound)
		Timestamp: json.Number(fmt.Sprintf("%d", now)),
		UserID: "manager_456",
		User: "Test Manager",
		Status: "ANSWER",
		CallStartTimestamp: json.Number(fmt.Sprintf("%d", start)),
		CallAnswerTimestamp: json.Number(fmt.Sprintf("%d", answer)),
		CallRecordLink: "https://sipuni.com/record/123",
	}

	raw, _ := json.Marshal(notifyReq)
	handleNotify(raw)

	// Verify manager user was ensured
	if _, ok := mockUserRepo.Users["manager_456"]; !ok {
		t.Error("Expected manager user to be ensured")
	}

	// Verify call record was created
	if len(mockCallRepo.Calls) != 1 {
		t.Errorf("Expected 1 call record, got %d", len(mockCallRepo.Calls))
	} else {
		call := mockCallRepo.Calls[0]
		if call.Source != "sipuni" {
			t.Errorf("Expected source 'sipuni', got %s", call.Source)
		}
		if call.ManagerID != "manager_456" {
			t.Errorf("Expected manager_id 'manager_456', got %s", call.ManagerID)
		}
		if call.ClientPhone != "79001112233" {
			t.Errorf("Expected client_phone '79001112233', got %s", call.ClientPhone)
		}
	}

	// Verify job was enqueued
	if len(mockPublisher.Jobs) != 1 {
		t.Errorf("Expected 1 job enqueued, got %d", len(mockPublisher.Jobs))
	} else {
		job := mockPublisher.Jobs[0]
		if job.AudioURL != "https://sipuni.com/record/123" {
			t.Errorf("Expected AudioURL 'https://sipuni.com/record/123', got %s", job.AudioURL)
		}
	}
}
