# SalesAI - Implementation Guide

**Version:** 1.0  
**Date:** February 2026  
**Purpose:** Step-by-step code examples for building each microservice

---

## Table of Contents

1. [Implementation Order](#implementation-order)
2. [Main API Service (Golang)](#main-api-service-golang)
3. [Webhook Service (Golang)](#webhook-service-golang)
4. [STT Service (Python)](#stt-service-python)
5. [AI Analytics Service (Python)](#ai-analytics-service-python)
6. [Frontend Integration](#frontend-integration)
7. [Testing Examples](#testing-examples)

---

## 1. Implementation Order

**Phase 1: Core Infrastructure (Week 1)**

1. Database setup & migrations ✅
2. Main API: Auth endpoints
3. Main API: User management
4. Webhook service: Basic ingestion

**Phase 2: AI Pipeline (Week 2)** 5. STT service: Audio processing 6. AI Analytics: LLM integration 7. Redis queue setup (BullMQ)

**Phase 3: Features (Week 3)** 8. Script management service 9. Google Sheets sync 10. Analytics endpoints

**Phase 4: Polish (Week 4)** 11. Frontend integration 12. Error handling & retries 13. Testing & deployment

---

## 2. Main API Service (Golang)

### 2.1 Project Setup

```bash
cd services/main-api
go mod init github.com/salesai/main-api
go mod tidy

# Install dependencies
go get github.com/gofiber/fiber/v2
go get github.com/golang-jwt/jwt/v5
go get github.com/lib/pq
go get github.com/go-redis/redis/v8
go get github.com/minio/minio-go/v7
go get golang.org/x/crypto/bcrypt
```

---

### 2.2 Core Domain Entities

**File:** `internal/core/domain/user.go`

```go
package domain

import (
    "time"
)

type User struct {
    ID          string    `json:"id"`
    CompanyID   string    `json:"company_id"`
    Email       string    `json:"email"`
    PasswordHash string   `json:"-"` // Never expose in JSON
    Role        UserRole  `json:"role"`
    ManagerID   *string   `json:"manager_id,omitempty"`
    ManagerName string    `json:"manager_name"`
    IsActive    bool      `json:"is_active"`
    LastLogin   *time.Time `json:"last_login,omitempty"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type UserRole string

const (
    RoleSuperAdmin  UserRole = "super_admin"
    RoleTenantAdmin UserRole = "tenant_admin"
    RoleSalesRep    UserRole = "sales_rep"
)

func (u *User) IsSalesRep() bool {
    return u.Role == RoleSalesRep
}

func (u *User) IsAdmin() bool {
    return u.Role == RoleTenantAdmin || u.Role == RoleSuperAdmin
}
```

**File:** `internal/core/domain/company.go`

```go
package domain

import "time"

type Company struct {
    ID                  string    `json:"id"`
    Name                string    `json:"name"`
    STTModelPreference  STTModel  `json:"stt_model_preference"`
    LLMProvider         LLMProvider `json:"llm_provider"`
    SubscriptionTier    string    `json:"subscription_tier"`
    IsActive            bool      `json:"is_active"`
    CreatedAt           time.Time `json:"created_at"`
    UpdatedAt           time.Time `json:"updated_at"`
}

type STTModel string

const (
    STTWhisperXLocal STTModel = "whisperx_local"
    STTOpenAI        STTModel = "openai"
    STTGemini        STTModel = "gemini"
)

type LLMProvider string

const (
    LLMOpenAI  LLMProvider = "openai"
    LLMGemini  LLMProvider = "gemini"
)
```

**File:** `internal/core/domain/call.go`

```go
package domain

import (
    "time"
)

type Call struct {
    ID           string     `json:"id"`
    CompanyID    string     `json:"company_id"`
    ManagerID    string     `json:"manager_id"`
    ManagerName  string     `json:"manager_name"`
    ClientPhone  string     `json:"client_phone"`
    ClientID     *string    `json:"client_id,omitempty"`
    Duration     int        `json:"duration"` // seconds
    CallLink     string     `json:"call_link"`
    ChatLink     *string    `json:"chat_link,omitempty"`
    CallDate     time.Time  `json:"call_date"`
    CallTime     time.Time  `json:"call_time"`
    Status       CallStatus `json:"status"`
    Source       string     `json:"source"`
    CreatedAt    time.Time  `json:"created_at"`
    UpdatedAt    time.Time  `json:"updated_at"`
}

type CallStatus string

const (
    StatusPending    CallStatus = "pending"
    StatusProcessing CallStatus = "processing"
    StatusCompleted  CallStatus = "completed"
    StatusError      CallStatus = "error"
)
```

---

### 2.3 Repository Interface & Implementation

**File:** `internal/core/ports/user_repository.go`

```go
package ports

import (
    "context"
    "github.com/salesai/main-api/internal/core/domain"
)

type UserRepository interface {
    Create(ctx context.Context, user *domain.User) error
    GetByID(ctx context.Context, id string) (*domain.User, error)
    GetByEmail(ctx context.Context, email string) (*domain.User, error)
    Update(ctx context.Context, user *domain.User) error
    Delete(ctx context.Context, id string) error
    ListByCompany(ctx context.Context, companyID string) ([]*domain.User, error)
}
```

**File:** `internal/adapters/repositories/user_repository.go`

```go
package repositories

import (
    "context"
    "database/sql"
    "errors"

    "github.com/salesai/main-api/internal/core/domain"
    "github.com/salesai/main-api/internal/core/ports"
)

type userRepository struct {
    db *sql.DB
}

func NewUserRepository(db *sql.DB) ports.UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
    query := `
        INSERT INTO auth_schema.users
        (id, company_id, email, password_hash, role, manager_id, manager_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING created_at, updated_at
    `

    err := r.db.QueryRowContext(
        ctx,
        query,
        user.ID,
        user.CompanyID,
        user.Email,
        user.PasswordHash,
        user.Role,
        user.ManagerID,
        user.ManagerName,
        user.IsActive,
    ).Scan(&user.CreatedAt, &user.UpdatedAt)

    return err
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
    query := `
        SELECT id, company_id, email, password_hash, role, manager_id, manager_name,
               is_active, last_login, created_at, updated_at
        FROM auth_schema.users
        WHERE LOWER(email) = LOWER($1) AND is_active = true
    `

    user := &domain.User{}
    err := r.db.QueryRowContext(ctx, query, email).Scan(
        &user.ID,
        &user.CompanyID,
        &user.Email,
        &user.PasswordHash,
        &user.Role,
        &user.ManagerID,
        &user.ManagerName,
        &user.IsActive,
        &user.LastLogin,
        &user.CreatedAt,
        &user.UpdatedAt,
    )

    if err == sql.ErrNoRows {
        return nil, errors.New("user not found")
    }

    return user, err
}

func (r *userRepository) ListByCompany(ctx context.Context, companyID string) ([]*domain.User, error) {
    query := `
        SELECT id, company_id, email, role, manager_id, manager_name,
               is_active, created_at, updated_at
        FROM auth_schema.users
        WHERE company_id = $1 AND is_active = true
        ORDER BY created_at DESC
    `

    rows, err := r.db.QueryContext(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    users := []*domain.User{}
    for rows.Next() {
        user := &domain.User{}
        err := rows.Scan(
            &user.ID,
            &user.CompanyID,
            &user.Email,
            &user.Role,
            &user.ManagerID,
            &user.ManagerName,
            &user.IsActive,
            &user.CreatedAt,
            &user.UpdatedAt,
        )
        if err != nil {
            return nil, err
        }
        users = append(users, user)
    }

    return users, nil
}
```

---

### 2.4 Use Case Example

**File:** `internal/core/usecases/auth/register.go`

```go
package auth

import (
    "context"
    "errors"
    "github.com/google/uuid"
    "golang.org/x/crypto/bcrypt"

    "github.com/salesai/main-api/internal/core/domain"
    "github.com/salesai/main-api/internal/core/ports"
)

type RegisterRequest struct {
    CompanyName string `json:"company_name" validate:"required,min=3,max=255"`
    Email       string `json:"email" validate:"required,email"`
    Password    string `json:"password" validate:"required,min=8"`
    ManagerName string `json:"manager_name" validate:"required"`
    ManagerID   string `json:"manager_id,omitempty"`
}

type RegisterResponse struct {
    User    *domain.User    `json:"user"`
    Company *domain.Company `json:"company"`
    Tokens  *TokenPair      `json:"tokens"`
}

type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int    `json:"expires_in"`
}

type RegisterUseCase struct {
    userRepo    ports.UserRepository
    companyRepo ports.CompanyRepository
    jwtService  ports.JWTService
}

func NewRegisterUseCase(
    userRepo ports.UserRepository,
    companyRepo ports.CompanyRepository,
    jwtService ports.JWTService,
) *RegisterUseCase {
    return &RegisterUseCase{
        userRepo:    userRepo,
        companyRepo: companyRepo,
        jwtService:  jwtService,
    }
}

func (uc *RegisterUseCase) Execute(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
    // Check if email already exists
    existing, _ := uc.userRepo.GetByEmail(ctx, req.Email)
    if existing != nil {
        return nil, errors.New("email already registered")
    }

    // Create company
    company := &domain.Company{
        ID:                 uuid.New().String(),
        Name:               req.CompanyName,
        STTModelPreference: domain.STTWhisperXLocal,
        LLMProvider:        domain.LLMOpenAI,
        SubscriptionTier:   "basic",
        IsActive:           true,
    }

    err := uc.companyRepo.Create(ctx, company)
    if err != nil {
        return nil, err
    }

    // Hash password
    passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, err
    }

    // Create user
    managerID := req.ManagerID
    if managerID == "" {
        managerID = "001" // Default for first user
    }

    user := &domain.User{
        ID:           uuid.New().String(),
        CompanyID:    company.ID,
        Email:        req.Email,
        PasswordHash: string(passwordHash),
        Role:         domain.RoleTenantAdmin,
        ManagerID:    &managerID,
        ManagerName:  req.ManagerName,
        IsActive:     true,
    }

    err = uc.userRepo.Create(ctx, user)
    if err != nil {
        return nil, err
    }

    // Generate tokens
    tokens, err := uc.jwtService.GenerateTokenPair(user)
    if err != nil {
        return nil, err
    }

    return &RegisterResponse{
        User:    user,
        Company: company,
        Tokens:  tokens,
    }, nil
}
```

---

### 2.5 HTTP Handler Example

**File:** `internal/adapters/http/handlers/auth_handler.go`

```go
package handlers

import (
    "github.com/gofiber/fiber/v2"
    "github.com/salesai/main-api/internal/core/usecases/auth"
    "github.com/salesai/main-api/pkg/validators"
)

type AuthHandler struct {
    registerUC *auth.RegisterUseCase
    loginUC    *auth.LoginUseCase
    validator  *validators.Validator
}

func NewAuthHandler(
    registerUC *auth.RegisterUseCase,
    loginUC *auth.LoginUseCase,
    validator *validators.Validator,
) *AuthHandler {
    return &AuthHandler{
        registerUC: registerUC,
        loginUC:    loginUC,
        validator:  validator,
    }
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
    var req auth.RegisterRequest

    if err := c.BodyParser(&req); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Invalid request body",
        })
    }

    if err := h.validator.Validate(&req); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Validation failed",
            "details": err,
        })
    }

    resp, err := h.registerUC.Execute(c.Context(), &req)
    if err != nil {
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
            "error": err.Error(),
        })
    }

    return c.Status(fiber.StatusCreated).JSON(resp)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
    var req auth.LoginRequest

    if err := c.BodyParser(&req); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Invalid request body",
        })
    }

    resp, err := h.loginUC.Execute(c.Context(), &req)
    if err != nil {
        return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
            "error": "Invalid credentials",
        })
    }

    return c.JSON(resp)
}
```

---

### 2.6 JWT Middleware

**File:** `internal/adapters/http/middleware/auth.go`

```go
package middleware

import (
    "strings"

    "github.com/gofiber/fiber/v2"
    "github.com/golang-jwt/jwt/v5"
    "github.com/salesai/main-api/internal/infrastructure/security"
)

type JWTClaims struct {
    UserID    string `json:"user_id"`
    CompanyID string `json:"company_id"`
    Role      string `json:"role"`
    Email     string `json:"email"`
    jwt.RegisteredClaims
}

func JWTAuth(jwtSecret string) fiber.Handler {
    return func(c *fiber.Ctx) error {
        authHeader := c.Get("Authorization")
        if authHeader == "" {
            return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                "error": "Missing authorization header",
            })
        }

        parts := strings.Split(authHeader, " ")
        if len(parts) != 2 || parts[0] != "Bearer" {
            return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                "error": "Invalid authorization format",
            })
        }

        tokenString := parts[1]

        claims := &JWTClaims{}
        token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
            return []byte(jwtSecret), nil
        })

        if err != nil || !token.Valid {
            return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                "error": "Invalid token",
            })
        }

        // Store claims in context
        c.Locals("user_id", claims.UserID)
        c.Locals("company_id", claims.CompanyID)
        c.Locals("role", claims.Role)
        c.Locals("email", claims.Email)

        return c.Next()
    }
}
```

---

### 2.7 Main Entry Point

**File:** `cmd/api/main.go`

```go
package main

import (
    "database/sql"
    "log"
    "os"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "github.com/gofiber/fiber/v2/middleware/logger"
    _ "github.com/lib/pq"

    "github.com/salesai/main-api/internal/adapters/http/handlers"
    "github.com/salesai/main-api/internal/adapters/http/middleware"
    "github.com/salesai/main-api/internal/adapters/repositories"
    "github.com/salesai/main-api/internal/core/usecases/auth"
    "github.com/salesai/main-api/internal/infrastructure/config"
    "github.com/salesai/main-api/internal/infrastructure/security"
    "github.com/salesai/main-api/pkg/validators"
)

func main() {
    // Load config
    cfg := config.Load()

    // Connect to database
    db, err := sql.Open("postgres", cfg.DatabaseURL)
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }
    defer db.Close()

    // Initialize repositories
    userRepo := repositories.NewUserRepository(db)
    companyRepo := repositories.NewCompanyRepository(db)

    // Initialize services
    jwtService := security.NewJWTService(cfg.JWTSecret, cfg.JWTExpiry)
    validator := validators.NewValidator()

    // Initialize use cases
    registerUC := auth.NewRegisterUseCase(userRepo, companyRepo, jwtService)
    loginUC := auth.NewLoginUseCase(userRepo, jwtService)

    // Initialize handlers
    authHandler := handlers.NewAuthHandler(registerUC, loginUC, validator)

    // Setup Fiber
    app := fiber.New(fiber.Config{
        ErrorHandler: customErrorHandler,
    })

    // Middleware
    app.Use(logger.New())
    app.Use(cors.New())

    // Health check
    app.Get("/health", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{"status": "healthy"})
    })

    // Routes
    api := app.Group("/api/v1")

    // Public routes
    authGroup := api.Group("/auth")
    authGroup.Post("/register", authHandler.Register)
    authGroup.Post("/login", authHandler.Login)

    // Protected routes
    protected := api.Group("", middleware.JWTAuth(cfg.JWTSecret))
    protected.Get("/users", /* handler */)
    protected.Get("/calls", /* handler */)

    // Start server
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("Server starting on port %s", port)
    log.Fatal(app.Listen(":" + port))
}

func customErrorHandler(c *fiber.Ctx, err error) error {
    code := fiber.StatusInternalServerError
    if e, ok := err.(*fiber.Error); ok {
        code = e.Code
    }

    return c.Status(code).JSON(fiber.Map{
        "error": err.Error(),
    })
}
```

---

## 3. Webhook Service (Golang)

### 3.1 Webhook Handler

**File:** `internal/adapters/http/handlers/amocrm_webhook.go`

```go
package handlers

import (
    "github.com/gofiber/fiber/v2"
    "github.com/google/uuid"
    "github.com/salesai/webhook-service/internal/core/usecases"
)

type AmoCRMWebhookHandler struct {
    processWebhookUC *usecases.ProcessWebhookUseCase
}

func NewAmoCRMWebhookHandler(uc *usecases.ProcessWebhookUseCase) *AmoCRMWebhookHandler {
    return &AmoCRMWebhookHandler{processWebhookUC: uc}
}

type AmoCRMPayload struct {
    EventType   string `json:"event_type"`
    ManagerID   string `json:"manager_id"`
    ManagerName string `json:"manager_name"`
    ClientPhone string `json:"client_phone"`
    ClientID    string `json:"client_id"`
    Duration    int    `json:"duration"`
    CallLink    string `json:"call_link"`
    ChatLink    string `json:"chat_link"`
    Timestamp   string `json:"timestamp"`
}

func (h *AmoCRMWebhookHandler) HandleCallFinished(c *fiber.Ctx) error {
    var payload AmoCRMPayload

    if err := c.BodyParser(&payload); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Invalid payload",
        })
    }

    // Generate call ID
    callID := uuid.New().String()

    // Process webhook (saves to DB + queues job)
    err := h.processWebhookUC.Execute(c.Context(), callID, &payload)
    if err != nil {
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
            "error": "Processing failed",
        })
    }

    // Return immediately (within 100ms)
    return c.JSON(fiber.Map{
        "status":  "received",
        "call_id": callID,
        "message": "Call queued for processing",
    })
}
```

---

### 3.2 BullMQ Publisher

**File:** `internal/adapters/queue/bullmq_publisher.go`

```go
package queue

import (
    "context"
    "encoding/json"

    "github.com/go-redis/redis/v8"
)

type BullMQPublisher struct {
    client *redis.Client
}

func NewBullMQPublisher(redisURL string) (*BullMQPublisher, error) {
    client := redis.NewClient(&redis.Options{
        Addr: redisURL,
    })

    _, err := client.Ping(context.Background()).Result()
    if err != nil {
        return nil, err
    }

    return &BullMQPublisher{client: client}, nil
}

type AudioProcessingJob struct {
    JobType    string `json:"job_type"`
    CallID     string `json:"call_id"`
    CompanyID  string `json:"company_id"`
    AudioURL   string `json:"audio_url"`
    ManagerID  string `json:"manager_id"`
    RetryCount int    `json:"retry_count"`
    MaxRetries int    `json:"max_retries"`
}

func (p *BullMQPublisher) EnqueueAudioProcessing(ctx context.Context, job *AudioProcessingJob) error {
    job.JobType = "audio_processing"
    job.MaxRetries = 3

    data, err := json.Marshal(job)
    if err != nil {
        return err
    }

    // Add to Redis list (BullMQ queue)
    return p.client.RPush(ctx, "bullmq:audio_processing", data).Err()
}
```

---

## 4. STT Service (Python)

### 4.1 Main Application

**File:** `main.py`

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio

from src.adapters.queue.bullmq_consumer import start_consumer
from src.adapters.api.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    consumer_task = asyncio.create_task(start_consumer())
    yield
    # Shutdown
    consumer_task.cancel()

app = FastAPI(title="STT Service", lifespan=lifespan)

app.include_router(router)

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "stt"}
```

---

### 4.2 BullMQ Consumer

**File:** `src/adapters/queue/bullmq_consumer.py`

```python
import asyncio
import json
import redis.asyncio as redis
from src.core.usecases.process_audio import ProcessAudioUseCase
from src.infrastructure.database.postgres_client import get_db
from src.config.settings import settings

async def start_consumer():
    r = await redis.from_url(settings.redis_url)

    print("STT Consumer started, waiting for jobs...")

    while True:
        try:
            # Blocking pop from queue
            result = await r.blpop("bullmq:audio_processing", timeout=5)

            if result:
                queue_name, job_data = result
                job = json.loads(job_data)

                print(f"Processing job: {job['call_id']}")

                # Process audio
                use_case = ProcessAudioUseCase()
                await use_case.execute(job)

        except Exception as e:
            print(f"Error processing job: {e}")
            await asyncio.sleep(5)
```

---

### 4.3 Process Audio Use Case

**File:** `src/core/usecases/process_audio.py`

```python
import asyncio
from src.infrastructure.stt.whisperx_local import WhisperXLocal
from src.infrastructure.stt.openai_api import OpenAIWhisper
from src.infrastructure.diarization.pyannote import PyannoteDriver
from src.infrastructure.audio.downloader import download_audio
from src.infrastructure.audio.converter import convert_to_wav
from src.adapters.storage.postgres_repo import save_transcript
from src.adapters.events.redis_publisher import publish_event
import os

class ProcessAudioUseCase:
    def __init__(self):
        self.whisperx = WhisperXLocal()
        self.openai = OpenAIWhisper()
        self.diarizer = PyannoteDriver()

    async def execute(self, job: dict):
        call_id = job['call_id']
        audio_url = job['audio_url']
        company_id = job['company_id']

        # Get company settings
        company_settings = await self.get_company_settings(company_id)
        stt_provider = company_settings['stt_model_preference']

        try:
            # 1. Download audio
            audio_path = await download_audio(audio_url, f"/tmp/{call_id}.mp3")

            # 2. Convert to WAV
            wav_path = convert_to_wav(audio_path)

            # 3. Diarize
            diarization = self.diarizer.diarize(wav_path)

            # 4. Transcribe based on provider
            if stt_provider == "whisperx_local":
                transcript = self.whisperx.transcribe(wav_path, diarization)
            elif stt_provider == "openai":
                transcript = await self.openai.transcribe(wav_path, diarization)
            else:
                raise ValueError(f"Unknown STT provider: {stt_provider}")

            # 5. Save transcript to database
            await save_transcript(call_id, transcript, stt_provider)

            # 6. Cleanup
            os.remove(audio_path)
            os.remove(wav_path)

            # 7. Publish event for AI Analytics
            await publish_event("transcript_ready", {
                "call_id": call_id,
                "company_id": company_id
            })

            print(f"✓ Transcript completed for call {call_id}")

        except Exception as e:
            print(f"✗ Error processing call {call_id}: {e}")
            # Log error to database
            await self.log_error(call_id, str(e))
            raise

    async def get_company_settings(self, company_id: str):
        # Fetch from DB
        # ... implementation
        return {"stt_model_preference": "whisperx_local"}

    async def log_error(self, call_id: str, error: str):
        # Save to processing_logs table
        pass
```

---

### 4.4 WhisperX Implementation

**File:** `src/infrastructure/stt/whisperx_local.py`

```python
import whisperx
import torch

class WhisperXLocal:
    def __init__(self):
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = whisperx.load_model(
            "large-v2",
            device=device,
            compute_type="float16" if device == "cuda" else "int8"
        )

    def transcribe(self, audio_path: str, diarization: dict) -> dict:
        # Load audio
        audio = whisperx.load_audio(audio_path)

        # Transcribe
        result = self.model.transcribe(audio, batch_size=16)

        # Align with diarization
        segments = self.merge_with_diarization(result['segments'], diarization)

        return {
            "segments": segments,
            "metadata": {
                "model": "whisperx-large-v2",
                "language": result.get('language', 'ru')
            }
        }

    def merge_with_diarization(self, transcription, diarization):
        # Merge logic here
        merged = []
        for segment in transcription:
            speaker = self.find_speaker(segment['start'], diarization)
            merged.append({
                "start": segment['start'],
                "end": segment['end'],
                "speaker": speaker,
                "text": segment['text']
            })
        return merged

    def find_speaker(self, timestamp, diarization):
        for turn in diarization:
            if turn['start'] <= timestamp <= turn['end']:
                return turn['speaker']
        return "UNKNOWN"
```

---

## 5. AI Analytics Service (Python)

### 5.1 Analyze Call Use Case

**File:** `src/core/usecases/analyze_call.py`

```python
from src.infrastructure.llm.openai_client import OpenAIClient
from src.infrastructure.prompts.system_prompt import SYSTEM_PROMPT, get_user_prompt
from src.adapters.storage.postgres_repo import (
    get_transcript,
    get_active_script,
    save_analysis
)

class AnalyzeCallUseCase:
    def __init__(self):
        self.llm = OpenAIClient()

    async def execute(self, call_id: str):
        # 1. Fetch transcript
        transcript = await get_transcript(call_id)

        # 2. Fetch company script
        script = await get_active_script(transcript['company_id'])

        # 3. Prepare prompt
        transcript_text = self.format_transcript(transcript['segments'])
        user_prompt = get_user_prompt(transcript_text, script['parsed_text'])

        # 4. Call LLM
        analysis = await self.llm.analyze(SYSTEM_PROMPT, user_prompt)

        # 5. Calculate KPI
        kpi = self.calculate_kpi(
            analysis['quality_score'],
            analysis['script_match'],
            analysis['errors_free'],
            transcript['duration']
        )

        # 6. Save report
        report = {
            'call_id': call_id,
            'script_id': script['id'],
            **analysis,
            'kpi': kpi
        }
        await save_analysis(report)

        # 7. Optional: Write back to CRM
        # await self.crm_client.add_note(call_id, analysis['brief'])

        print(f"✓ Analysis completed for call {call_id}")
        return report

    def format_transcript(self, segments):
        lines = []
        for seg in segments:
            lines.append(f"[{seg['speaker']}]: {seg['text']}")
        return "\n".join(lines)

    def calculate_kpi(self, quality, script_match, errors_free, duration):
        overall = (quality * 0.4 + script_match * 0.4 + errors_free * 0.2)
        duration_minutes = duration / 60
        return round(overall * duration_minutes, 1)
```

---

### 5.2 OpenAI Client

**File:** `src/infrastructure/llm/openai_client.py`

```python
import openai
import json
from src.config.settings import settings

class OpenAIClient:
    def __init__(self):
        openai.api_key = settings.openai_api_key

    async def analyze(self, system_prompt: str, user_prompt: str) -> dict:
        response = await openai.ChatCompletion.acreate(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        content = response.choices[0].message.content
        return json.loads(content)
```

---

## 6. Frontend Integration

### 6.1 API Client (TypeScript)

```typescript
// src/lib/api-client.ts

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

class APIClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("access_token", token);
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      "Content-Type": "application/json",
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Auth
  async register(data: RegisterRequest) {
    return this.request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest) {
    const response = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setToken(response.tokens.access_token);
    return response;
  }

  // Calls
  async getCalls(params?: CallsQueryParams) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<ListCallsResponse>(`/calls?${query}`);
  }

  async getCallDetails(id: string) {
    return this.request<CallDetailDTO>(`/calls/${id}`);
  }
}

export const apiClient = new APIClient();
```

---

## 7. Testing Examples

### 7.1 Golang Unit Test

**File:** `internal/core/usecases/auth/register_test.go`

```go
package auth_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"

    "github.com/salesai/main-api/internal/core/usecases/auth"
)

type MockUserRepository struct {
    mock.Mock
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
    args := m.Called(ctx, email)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*domain.User), args.Error(1)
}

func TestRegisterUseCase_Execute_Success(t *testing.T) {
    // Arrange
    mockUserRepo := new(MockUserRepository)
    mockCompanyRepo := new(MockCompanyRepository)
    mockJWTService := new(MockJWTService)

    mockUserRepo.On("GetByEmail", mock.Anything, "test@example.com").Return(nil, errors.New("not found"))
    mockCompanyRepo.On("Create", mock.Anything, mock.Anything).Return(nil)
    mockUserRepo.On("Create", mock.Anything, mock.Anything).Return(nil)
    mockJWTService.On("GenerateTokenPair", mock.Anything).Return(&auth.TokenPair{
        AccessToken: "token123",
    }, nil)

    uc := auth.NewRegisterUseCase(mockUserRepo, mockCompanyRepo, mockJWTService)

    // Act
    req := &auth.RegisterRequest{
        CompanyName: "Test Co",
        Email:       "test@example.com",
        Password:    "Password123",
        ManagerName: "Test Manager",
    }

    resp, err := uc.Execute(context.Background(), req)

    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, resp)
    assert.Equal(t, "Test Co", resp.Company.Name)
    mockUserRepo.AssertExpectations(t)
}
```

---

### 7.2 Python Unit Test

**File:** `tests/test_process_audio.py`

```python
import pytest
from unittest.mock import AsyncMock, patch
from src.core.usecases.process_audio import ProcessAudioUseCase

@pytest.mark.asyncio
async def test_process_audio_success():
    # Arrange
    use_case = ProcessAudioUseCase()

    job = {
        'call_id': 'test-call-id',
        'audio_url': 'https://example.com/audio.mp3',
        'company_id': 'test-company'
    }

    with patch.object(use_case, 'get_company_settings', new_callable=AsyncMock) as mock_settings:
        mock_settings.return_value = {'stt_model_preference': 'whisperx_local'}

        # Act
        await use_case.execute(job)

        # Assert
        mock_settings.assert_called_once()
```

---

## 8. Implementation Checklist

### Main API Service

- [ ] Database connection & migrations
- [ ] Domain entities (User, Company, Call)
- [ ] Repository implementations
- [ ] Auth use cases (Register, Login)
- [ ] JWT middleware
- [ ] HTTP handlers
- [ ] Call CRUD endpoints
- [ ] Analytics endpoints

### Webhook Service

- [ ] AmoCRM webhook handler
- [ ] BullMQ publisher
- [ ] Database integration
- [ ] Fast response (<100ms)

### STT Service

- [ ] BullMQ consumer
- [ ] Audio download & conversion
- [ ] WhisperX integration
- [ ] Pyannote diarization
- [ ] Transcript storage
- [ ] Event publishing

### AI Analytics

- [ ] Event consumer
- [ ] LLM integration (OpenAI/Gemini)
- [ ] KPI calculation
- [ ] Analysis storage
- [ ] CRM write-back

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026  
**Ready for Implementation:** ✅
