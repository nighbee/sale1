# SalesAI - Complete System Architecture

**Version:** 1.0  
**Date:** February 2026  
**Status:** Design Approved

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Microservices Architecture](#microservices-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Database Schema](#database-schema)
5. [API Specifications](#api-specifications)
6. [Communication Protocols](#communication-protocols)
7. [Technology Stack](#technology-stack)
8. [Deployment Architecture](#deployment-architecture)

---

## 1. System Overview

### 1.1 Architecture Pattern

- **Pattern**: Microservices with Event-Driven Architecture
- **Communication**: gRPC (Go↔Python) + Event Streams (AI Pipeline)
- **Queue**: BullMQ (Redis-backed)
- **Storage**: PostgreSQL (single DB, multi-schema) + MinIO (S3-compatible)

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌──────────────┐     ┌──────────────┐      ┌──────────────┐       │
│  │   Web App    │     │  Mobile App  │      │ External CRM │       │
│  │ (Next.js)    │     │  (React)     │      │  (AmoCRM)    │       │
│  └──────┬───────┘     └──────┬───────┘      └──────┬───────┘       │
└─────────┼────────────────────┼─────────────────────┼────────────────┘
          │                    │                     │
          ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (NGINX)                             │
└─────────────────────────────────────────────────────────────────────┘
          │
          ├──────────────┬──────────────┬──────────────┬──────────────┐
          ▼              ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Main API    │ │  Webhook &   │ │ Google Sheets│ │   Script     │ │              │
│  Service     │ │  Ingestion   │ │ Sync Service │ │  Management  │ │  (Golang)    │
│  (Golang)    │ │  (Golang)    │ │  (Golang)    │ │  (Go+Python) │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────────────┘
       │                │                │                │
       │                └────────────────┴────────────────┘
       │                             │
       │                             ▼
       │                    ┌──────────────────┐
       │                    │   BullMQ Queue   │
       │                    │     (Redis)      │
       │                    └────────┬─────────┘
       │                             │
       │                ┌────────────┴────────────┐
       │                ▼                         ▼
       │         ┌──────────────┐         ┌──────────────┐
       │         │ STT Service  │         │ AI Analytics │
       │         │  (Python)    │────────▶│   Service    │
       │         │              │  Event  │  (Python)    │
       │         └──────┬───────┘         └──────┬───────┘
       │                │                        │
       │                │                        │
       └────────────────┴────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │    PostgreSQL DB      │
            │  (Multi-Schema)       │
            └───────────────────────┘

            ┌───────────────────────┐
            │      MinIO (S3)       │
            │  - Audio Files        │
            │  - Script Files       │
            └───────────────────────┘
```

---

## 2. Microservices Architecture

### 2.1 Service Inventory

| Service               | Language    | Port | Responsibility                | Clean Architecture |
| --------------------- | ----------- | ---- | ----------------------------- | ------------------ |
| **Main API**          | Golang      | 8080 | Auth, CRUD, Analytics APIs    | ✅                 |
| **Webhook Ingestion** | Golang      | 8081 | AmoCRM webhook receiver       | ✅                 |
| **Sheets Sync**       | Golang      | 8082 | Poll Google Sheets every 5min | ✅                 |
| **Script Management** | Go + Python | 8083 | Upload, parse, store scripts  | ✅                 |
| **STT Service**       | Python      | 5001 | Speech-to-Text processing     | ✅                 |
| **AI Analytics**      | Python      | 5002 | LLM-based call analysis       | ✅                 |

---

### 2.2 Service Details

#### **Service 1: Main API (Golang)**

**Responsibilities:**

- User authentication (JWT)
- RBAC enforcement (Admin/Director/Rep)
- CRUD operations for calls, users, companies
- Analytics aggregation endpoints
- Serve frontend (Next.js)

**Clean Architecture Layers:**

```
main-api/
├── cmd/
│   └── api/
│       └── main.go
├── internal/
│   ├── adapters/           # Interface Adapters
│   │   ├── http/
│   │   │   ├── handlers/   # HTTP Controllers
│   │   │   ├── middleware/ # JWT, RBAC, Logging
│   │   │   └── routes.go
│   │   ├── grpc/           # gRPC Clients (to Python services)
│   │   └── repositories/   # PostgreSQL implementations
│   ├── core/               # Enterprise Business Rules
│   │   ├── domain/         # Entities (User, Call, Company)
│   │   ├── ports/          # Interfaces (repositories, services)
│   │   └── usecases/       # Business Logic
│   └── infrastructure/     # Frameworks & Drivers
│       ├── config/
│       ├── database/
│       └── logger/
├── pkg/                    # Shared utilities
│   ├── dto/                # Data Transfer Objects
│   ├── errors/
│   └── validators/
└── go.mod
```

**Key Endpoints:**

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/calls` (with filters: manager_id, date_range, status)
- `GET /api/v1/calls/:id`
- `GET /api/v1/analytics/team-performance`
- `GET /api/v1/analytics/leaderboard`
- `PUT /api/v1/companies/:id/settings` (STT model preference)

---

#### **Service 2: Webhook & Ingestion (Golang)**

**Responsibilities:**

- Receive AmoCRM webhooks (call finished events)
- Validate payload
- Push to BullMQ queue (fast response <100ms)
- Return 200 OK immediately

**Clean Architecture:**

```
webhook-service/
├── cmd/
│   └── webhook/
│       └── main.go
├── internal/
│   ├── adapters/
│   │   ├── http/
│   │   │   └── handlers/
│   │   │       └── amocrm_webhook.go
│   │   └── queue/          # BullMQ publisher
│   │       └── bullmq.go
│   ├── core/
│   │   ├── domain/
│   │   │   └── webhook_event.go
│   │   └── usecases/
│   │       └── process_webhook.go
│   └── infrastructure/
│       └── redis/
└── pkg/
    └── dto/
        └── amocrm_payload.go
```

**Webhook Payload (AmoCRM):**

```json
{
  "event_type": "call_finished",
  "manager_id": "222",
  "manager_name": "Anzhelika",
  "client_phone": "77081996454",
  "client_id": "33817535",
  "duration": 1321,
  "call_link": "https://files.salebot.pro/.../file.mp3",
  "chat_link": "https://...",
  "timestamp": "2025-09-12T17:43:00Z"
}
```

**BullMQ Queue Job:**

```json
{
  "job_type": "audio_processing",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "audio_url": "https://...",
  "manager_id": "222",
  "retry_count": 0,
  "max_retries": 3
}
```

---

#### **Service 3: Google Sheets Sync (Golang)**

**Responsibilities:**

- Poll Google Sheets every 5 minutes
- Detect new rows (compare timestamps or row count)
- Transform sheet data to internal format
- Push to same BullMQ queue as webhooks

**Clean Architecture:**

```
sheets-sync/
├── cmd/
│   └── sync/
│       └── main.go
├── internal/
│   ├── adapters/
│   │   ├── sheets/         # Google Sheets API client
│   │   │   └── client.go
│   │   └── queue/
│   │       └── bullmq.go
│   ├── core/
│   │   ├── domain/
│   │   │   └── call_entry.go
│   │   └── usecases/
│   │       └── sync_calls.go
│   └── infrastructure/
│       ├── cron/           # 5-minute scheduler
│       └── cache/          # Redis for last sync state
└── pkg/
    └── parsers/
        └── sheet_row.go
```

**Sheet Row Mapping:**

```go
type SheetCallEntry struct {
    Date         string  // "12.09.2025"
    Time         string  // "17:43"
    ManagerID    string  // "222"
    ManagerName  string  // "Anzhelika"
    ClientPhone  string  // "77081996454"
    ClientID     string  // "33817535"
    Duration     int     // 1321
    CallLink     string  // "https://..."
    ChatLink     string  // Optional
    // Metrics (if pre-filled, skip processing)
    QualityScore *int
    ScriptMatch  *int
    // ... other fields
}
```

**Sync Logic:**

1. Fetch all rows from Sheets
2. Compare with `last_sync_timestamp` in Redis
3. Filter new entries
4. For each new entry:
   - If metrics are empty → push to BullMQ
   - If metrics exist → insert directly to DB (manual upload)

---

#### **Service 4: Script Management (Golang + Python)**

**Responsibilities:**

- Upload script files (DOCX/PDF) to MinIO
- Parse text content (Python subprocess)
- Store parsed text in PostgreSQL
- Provide retrieval API for AI service

**Clean Architecture:**

```
script-service/
├── cmd/
│   └── script/
│       └── main.go
├── internal/
│   ├── adapters/
│   │   ├── http/
│   │   │   └── handlers/
│   │   │       ├── upload.go
│   │   │       ├── list.go
│   │   │       └── delete.go
│   │   ├── storage/
│   │   │   └── minio.go
│   │   ├── parser/         # Calls Python script
│   │   │   └── document_parser.go
│   │   └── repositories/
│   │       └── script_repo.go
│   ├── core/
│   │   ├── domain/
│   │   │   └── script.go
│   │   └── usecases/
│   │       ├── upload_script.go
│   │       └── parse_script.go
│   └── infrastructure/
└── scripts/                # Python parsers
    ├── parse_docx.py
    └── parse_pdf.py
```

**Python Parser (parse_docx.py):**

```python
import sys
from docx import Document

def extract_text(file_path):
    doc = Document(file_path)
    text = "\n".join([para.text for para in doc.paragraphs])
    return text

if __name__ == "__main__":
    file_path = sys.argv[1]
    print(extract_text(file_path))
```

**API Endpoints:**

- `POST /api/v1/scripts` (upload file)
- `GET /api/v1/scripts/:company_id` (list all scripts)
- `GET /api/v1/scripts/:id/content` (get parsed text)
- `DELETE /api/v1/scripts/:id`

---

#### **Service 5: STT Service (Python)**

**Responsibilities:**

- Consume BullMQ jobs
- Download audio from URL
- Run STT based on company preference:
  - **Local**: WhisperX + Pyannote
  - **Cloud**: OpenAI Whisper API or Google Gemini STT
- Save transcript to PostgreSQL
- Emit event to Redis Stream for AI Analytics

**Clean Architecture:**

```
stt-service/
├── main.py
├── src/
│   ├── adapters/           # Interface Adapters
│   │   ├── queue/
│   │   │   └── bullmq_consumer.py
│   │   ├── storage/
│   │   │   ├── minio_client.py
│   │   │   └── postgres_repo.py
│   │   └── events/
│   │       └── redis_publisher.py
│   ├── core/               # Business Logic
│   │   ├── domain/
│   │   │   ├── transcript.py
│   │   │   └── audio.py
│   │   ├── ports/          # Interfaces
│   │   │   ├── stt_provider.py
│   │   │   └── diarization_provider.py
│   │   └── usecases/
│   │       └── process_audio.py
│   ├── infrastructure/     # Frameworks
│   │   ├── stt/
│   │   │   ├── whisperx_local.py
│   │   │   ├── openai_api.py
│   │   │   └── gemini_api.py
│   │   ├── diarization/
│   │   │   └── pyannote.py
│   │   └── audio/
│   │       └── converter.py  # 16kHz WAV conversion
│   └── config/
│       └── settings.py
├── requirements.txt
└── Dockerfile
```

**Processing Flow:**

1. Receive job from BullMQ
2. Fetch company settings (STT preference)
3. Download audio to `/tmp`
4. Convert to 16kHz WAV
5. Run diarization (Pyannote)
6. Run STT (WhisperX/OpenAI/Gemini)
7. Merge diarization + transcript
8. Save to `transcripts` table
9. Delete audio from `/tmp`
10. Publish event: `transcript_ready`

**Transcript JSON Format:**

```json
{
  "call_id": "uuid",
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "speaker": "SPEAKER_0",
      "text": "Здравствуйте, меня зовут Анжелика"
    },
    {
      "start": 3.5,
      "end": 5.1,
      "speaker": "SPEAKER_1",
      "text": "Добрый день"
    }
  ],
  "metadata": {
    "stt_provider": "whisperx_local",
    "diarization": "pyannote",
    "processing_time_seconds": 45
  }
}
```

**Retry Logic:**

```python
@bullmq_job(max_retries=3, backoff_delay=5000)
def process_audio_job(job_data):
    try:
        # ... processing
    except Exception as e:
        if job_data['retry_count'] < 3:
            raise  # Re-queue
        else:
            # Log to processing_logs table with error
            save_error_log(call_id, "STT", str(e))
```

---

#### **Service 6: AI Analytics Service (Python)**

**Responsibilities:**

- Consume `transcript_ready` events from Redis Stream
- Fetch transcript + script from DB/MinIO
- Run LLM analysis (OpenAI/Gemini based on company pref)
- Calculate metrics (Quality, Script Match, Errors)
- Compute KPI (predefined formula)
- Save to `analysis_reports` table
- Write back to AmoCRM (optional)

**Clean Architecture:**

```
ai-analytics/
├── main.py
├── src/
│   ├── adapters/
│   │   ├── events/
│   │   │   └── redis_consumer.py
│   │   ├── storage/
│   │   │   ├── minio_client.py
│   │   │   └── postgres_repo.py
│   │   └── crm/
│   │       └── amocrm_client.py
│   ├── core/
│   │   ├── domain/
│   │   │   ├── analysis_report.py
│   │   │   └── metrics.py
│   │   ├── ports/
│   │   │   └── llm_provider.py
│   │   └── usecases/
│   │       ├── analyze_call.py
│   │       └── calculate_kpi.py
│   ├── infrastructure/
│   │   ├── llm/
│   │   │   ├── openai_client.py
│   │   │   └── gemini_client.py
│   │   └── prompts/
│   │       ├── system_prompt.py
│   │       └── scoring_rubric.py
│   └── config/
└── requirements.txt
```

**LLM Prompt Structure:**

```python
SYSTEM_PROMPT = """
You are a sales quality analyst. Analyze the call transcript against the provided script.

Output a JSON with:
{
  "quality_score": 0-100,
  "script_match": 0-100,
  "errors_free": 0-100,
  "overall_rating": weighted average,
  "recommendation": "3 sentences of actionable feedback",
  "brief": "3 sentence summary",
  "next_best_action": "Concrete next step for the rep"
}

Scoring Rubric:
- Quality: Tone, clarity, professionalism
- Script Match: Adherence to phases and keywords
- Errors Free: No rude language, no prohibited words
"""

def analyze_call(transcript: str, script: str, company_llm: str):
    user_prompt = f"""
    TRANSCRIPT:
    {transcript}

    SCRIPT:
    {script}

    Analyze the call.
    """

    if company_llm == "openai":
        response = openai.ChatCompletion.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
    else:  # gemini
        response = gemini_client.generate(...)

    return parse_json(response)
```

**KPI Calculation (Predefined):**

```python
def calculate_kpi(quality: int, script_match: int, errors_free: int, duration: int) -> float:
    """
    KPI = (Quality * 0.4 + ScriptMatch * 0.4 + ErrorsFree * 0.2) * (Duration / 60)
    """
    overall = (quality * 0.4 + script_match * 0.4 + errors_free * 0.2)
    duration_minutes = duration / 60
    return round(overall * duration_minutes, 1)
```

---

## 3. Data Flow Diagrams

### 3.1 Call Processing Pipeline (Happy Path)

```
┌─────────────┐
│  AmoCRM     │ (Webhook: call finished)
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Webhook Service (Go) │ (Validate, generate call_id)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  BullMQ Queue        │ (Job: audio_processing)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  STT Service (Py)    │
│  1. Download audio   │
│  2. Convert to WAV   │
│  3. Diarize          │
│  4. Transcribe       │
│  5. Save to DB       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Redis Stream         │ (Event: transcript_ready)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ AI Analytics (Py)    │
│  1. Fetch transcript │
│  2. Fetch script     │
│  3. Run LLM          │
│  4. Calculate KPI    │
│  5. Save report      │
│  6. Push to CRM      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  PostgreSQL          │ (analysis_reports table)
└──────────────────────┘
```

### 3.2 Google Sheets Sync Flow

```
┌──────────────────────┐
│  Cron Job (5 min)    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Sheets Sync (Go)     │ (Fetch all rows)
└──────┬───────────────┘
       │
       ├─────────────────────┐
       │                     │
       ▼                     ▼
┌─────────────┐      ┌──────────────┐
│ New rows    │      │ Existing     │
│ (no metrics)│      │ (has metrics)│
└──────┬──────┘      └──────┬───────┘
       │                     │
       ▼                     ▼
┌─────────────┐      ┌──────────────┐
│ Push to     │      │ Insert to DB │
│ BullMQ      │      │ directly     │
└─────────────┘      └──────────────┘
```

---

## 4. Database Schema

### 4.1 PostgreSQL Schema Design

**Multi-Schema Approach:**

- `auth_schema`: companies, users
- `calls_schema`: calls, transcripts, analysis_reports
- `scripts_schema`: scripts
- `integrations_schema`: integrations
- `logs_schema`: processing_logs, notifications

### 4.2 Table Definitions

```sql
-- =============================================
-- SCHEMA: auth_schema
-- =============================================

CREATE TABLE auth_schema.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    stt_model_preference VARCHAR(50) DEFAULT 'whisperx_local', -- 'whisperx_local', 'openai', 'gemini'
    llm_provider VARCHAR(50) DEFAULT 'openai', -- 'openai', 'gemini'
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE auth_schema.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'super_admin', 'tenant_admin', 'sales_rep'
    manager_id VARCHAR(50), -- Maps to "Man id" in sheet (e.g., "222")
    manager_name VARCHAR(255), -- Maps to "Man name" (e.g., "Anzhelika")
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_company ON auth_schema.users(company_id);
CREATE INDEX idx_users_manager ON auth_schema.users(manager_id);

-- =============================================
-- SCHEMA: scripts_schema
-- =============================================

CREATE TABLE scripts_schema.scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path_minio VARCHAR(500) NOT NULL, -- MinIO object key
    parsed_text TEXT NOT NULL, -- Extracted text from DOCX/PDF
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scripts_company ON scripts_schema.scripts(company_id);

-- =============================================
-- SCHEMA: integrations_schema
-- =============================================

CREATE TABLE integrations_schema.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL, -- 'amocrm', 'google_sheets'
    credentials JSONB NOT NULL, -- OAuth tokens, API keys
    config JSONB, -- Additional settings
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SCHEMA: calls_schema
-- =============================================

CREATE TABLE calls_schema.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES auth_schema.companies(id) ON DELETE CASCADE,
    manager_id VARCHAR(50) NOT NULL, -- "222"
    manager_name VARCHAR(255), -- "Anzhelika"
    client_phone VARCHAR(50) NOT NULL,
    client_id VARCHAR(50), -- CRM client ID
    duration INT NOT NULL, -- seconds
    call_link VARCHAR(500) NOT NULL, -- URL to audio file
    chat_link VARCHAR(500),
    call_date DATE NOT NULL,
    call_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calls_company ON calls_schema.calls(company_id);
CREATE INDEX idx_calls_manager ON calls_schema.calls(manager_id);
CREATE INDEX idx_calls_status ON calls_schema.calls(status);
CREATE INDEX idx_calls_date ON calls_schema.calls(call_date);

-- =============================================

CREATE TABLE calls_schema.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    speaker_diarized_json JSONB NOT NULL, -- Array of {start, end, speaker, text}
    stt_provider VARCHAR(50) NOT NULL, -- 'whisperx_local', 'openai', 'gemini'
    processing_time_seconds INT,
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transcripts_call ON calls_schema.transcripts(call_id);

-- =============================================

CREATE TABLE calls_schema.analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    quality_score INT CHECK (quality_score >= 0 AND quality_score <= 100),
    script_match INT CHECK (script_match >= 0 AND script_match <= 100),
    errors_free INT CHECK (errors_free >= 0 AND errors_free <= 100),
    overall_rating DECIMAL(5,2),
    kpi DECIMAL(10,2),
    recommendation TEXT,
    brief TEXT,
    next_best_action TEXT,
    llm_provider VARCHAR(50),
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analysis_call ON calls_schema.analysis_reports(call_id);

-- =============================================
-- SCHEMA: logs_schema
-- =============================================

CREATE TABLE logs_schema.processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls_schema.calls(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL, -- 'stt_service', 'ai_analytics'
    status VARCHAR(50) NOT NULL, -- 'processing', 'completed', 'error'
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_call ON logs_schema.processing_logs(call_id);
CREATE INDEX idx_logs_status ON logs_schema.processing_logs(status);

-- =============================================

CREATE TABLE logs_schema.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'email', 'telegram', 'in_app'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON logs_schema.notifications(user_id);
```

### 4.3 Relationships Diagram

```
companies (1) ──────┬────── (N) users
                    │
                    ├────── (N) scripts
                    │
                    ├────── (N) integrations
                    │
                    └────── (N) calls ──┬─── (1) transcripts
                                        │
                                        ├─── (1) analysis_reports
                                        │
                                        └─── (N) processing_logs

users (1) ────────────── (N) notifications
```

---

## 5. API Specifications

### 5.1 Main API Endpoints

#### **Auth Group**

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

#### **Users Group** (Admin only)

```
GET    /api/v1/users
POST   /api/v1/users/invite
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
```

#### **Companies Group** (Admin only)

```
GET    /api/v1/companies/:id
PUT    /api/v1/companies/:id/settings
```

**Example: Update Company Settings**

```json
PUT /api/v1/companies/uuid/settings
{
  "stt_model_preference": "openai",
  "llm_provider": "gemini"
}
```

#### **Calls Group**

```
GET    /api/v1/calls
GET    /api/v1/calls/:id
GET    /api/v1/calls/:id/transcript
GET    /api/v1/calls/:id/analysis
GET    /api/v1/calls/:id/audio (stream from MinIO)
POST   /api/v1/calls/:id/reprocess (retry failed)
```

**Example: List Calls**

```
GET /api/v1/calls?manager_id=222&status=completed&date_from=2025-09-01&date_to=2025-09-30&page=1&limit=20
```

**Response:**

```json
{
  "calls": [
    {
      "id": "uuid",
      "manager_name": "Anzhelika",
      "client_phone": "77081996454",
      "duration": 1321,
      "call_date": "2025-09-12",
      "status": "completed",
      "quality_score": 90,
      "overall_rating": 93.3
    }
  ],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20
  }
}
```

#### **Scripts Group**

```
POST   /api/v1/scripts (upload)
GET    /api/v1/scripts
GET    /api/v1/scripts/:id
GET    /api/v1/scripts/:id/content
PUT    /api/v1/scripts/:id
DELETE /api/v1/scripts/:id
```

**Example: Upload Script**

```
POST /api/v1/scripts
Content-Type: multipart/form-data

name: "Sales Script Q1 2026"
file: [binary DOCX file]
```

#### **Analytics Group**

```
GET    /api/v1/analytics/team-performance
GET    /api/v1/analytics/leaderboard
GET    /api/v1/analytics/trends
```

**Example: Team Performance**

```
GET /api/v1/analytics/team-performance?period=last_30_days
```

**Response:**

```json
{
  "period": "2025-09-01 to 2025-09-30",
  "managers": [
    {
      "manager_id": "222",
      "manager_name": "Anzhelika",
      "total_calls": 45,
      "avg_quality": 88.5,
      "avg_script_match": 92.1,
      "avg_kpi": 15890.3
    }
  ]
}
```

### 5.2 Webhook Endpoints

```
POST   /api/v1/webhooks/amocrm/call-finished
POST   /api/v1/webhooks/google-sheets (if using App Script)
```

---

## 6. Communication Protocols

### 6.1 gRPC Service Definitions

**File: `proto/stt_service.proto`**

```protobuf
syntax = "proto3";

package stt;

service STTService {
  rpc GetTranscript(TranscriptRequest) returns (TranscriptResponse);
}

message TranscriptRequest {
  string call_id = 1;
}

message TranscriptResponse {
  string call_id = 1;
  string transcript_json = 2; // JSON string
  string stt_provider = 3;
  int32 processing_time = 4;
}
```

**File: `proto/analytics_service.proto`**

```protobuf
syntax = "proto3";

package analytics;

service AnalyticsService {
  rpc GetAnalysis(AnalysisRequest) returns (AnalysisResponse);
}

message AnalysisRequest {
  string call_id = 1;
}

message AnalysisResponse {
  string call_id = 1;
  int32 quality_score = 2;
  int32 script_match = 3;
  int32 errors_free = 4;
  double overall_rating = 5;
  double kpi = 6;
  string recommendation = 7;
  string brief = 8;
  string next_best_action = 9;
}
```

### 6.2 Event Streams (Redis Streams)

**Stream: `transcript_ready`**

```json
{
  "event_type": "transcript_ready",
  "call_id": "uuid",
  "company_id": "uuid",
  "timestamp": "2026-02-08T10:30:00Z"
}
```

**Stream: `analysis_completed`**

```json
{
  "event_type": "analysis_completed",
  "call_id": "uuid",
  "overall_rating": 93.3,
  "timestamp": "2026-02-08T10:35:00Z"
}
```

### 6.3 BullMQ Job Schema

```typescript
interface AudioProcessingJob {
  job_type: "audio_processing";
  call_id: string;
  company_id: string;
  audio_url: string;
  manager_id: string;
  retry_count: number;
  max_retries: 3;
}
```

---

## 7. Technology Stack

### 7.1 Services Stack

| Component             | Technology            | Version      |
| --------------------- | --------------------- | ------------ |
| **Main API**          | Golang (Fiber)        | 1.22 / 2.52  |
| **Webhook Service**   | Golang (Fiber)        | 1.22 / 2.52  |
| **Sheets Sync**       | Golang (Fiber + Cron) | 1.22 / 2.52  |
| **Script Management** | Golang + Python       | 1.22 / 3.11  |
| **STT Service**       | Python (FastAPI)      | 3.11 / 0.109 |
| **AI Analytics**      | Python (FastAPI)      | 3.11 / 0.109 |

### 7.2 Infrastructure Stack

| Component            | Technology           | Version            |
| -------------------- | -------------------- | ------------------ |
| **Database**         | PostgreSQL           | 16                 |
| **Queue**            | Redis + BullMQ       | 7.2                |
| **Object Storage**   | MinIO                | RELEASE.2024-01-01 |
| **API Gateway**      | Nginx                | 1.25               |
| **Containerization** | Docker + Compose     | 24.0 / 2.23        |
| **Monitoring**       | Grafana + Prometheus | (Phase 2)          |

### 7.3 Python Libraries

**STT Service:**

```
whisperx==3.1.1
pyannote.audio==3.1.1
openai==1.12.0
google-cloud-speech==2.24.0
fastapi==0.109.0
pydantic==2.6.0
psycopg2-binary==2.9.9
redis==5.0.1
minio==7.2.3
```

**AI Analytics:**

```
openai==1.12.0
google-generativeai==0.3.2
langchain==0.1.6
fastapi==0.109.0
psycopg2-binary==2.9.9
redis==5.0.1
```

**Script Parser:**

```
python-docx==1.1.0
PyPDF2==3.0.1
```

### 7.4 Golang Libraries

```go
// go.mod
module github.com/salesai/main-api

go 1.22

require (
    github.com/gofiber/fiber/v2 v2.52.0
    github.com/golang-jwt/jwt/v5 v5.2.0
    github.com/lib/pq v1.10.9
    github.com/go-redis/redis/v8 v8.11.5
    github.com/minio/minio-go/v7 v7.0.66
    google.golang.org/grpc v1.61.0
    google.golang.org/protobuf v1.32.0
    github.com/robfig/cron/v3 v3.0.1 // For Sheets Sync
)
```

---

## 8. Deployment Architecture

### 8.1 Docker Compose Structure

```yaml
version: "3.8"

services:
  # ============ Databases ============
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: salesai
      POSTGRES_USER: salesai_user
      POSTGRES_PASSWORD: strong_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:RELEASE.2024-01-01T16-36-33Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  # ============ Golang Services ============
  main-api:
    build: ./services/main-api
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      REDIS_HOST: redis
      MINIO_ENDPOINT: minio:9000
    depends_on:
      - postgres
      - redis
      - minio

  webhook-service:
    build: ./services/webhook-service
    ports:
      - "8081:8081"
    environment:
      REDIS_HOST: redis
    depends_on:
      - redis

  sheets-sync:
    build: ./services/sheets-sync
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      GOOGLE_SHEETS_CREDS: /secrets/google-sheets.json
    volumes:
      - ./secrets:/secrets
    depends_on:
      - postgres
      - redis

  script-service:
    build: ./services/script-service
    ports:
      - "8083:8083"
    environment:
      DB_HOST: postgres
      MINIO_ENDPOINT: minio:9000
    depends_on:
      - postgres
      - minio

  # ============ Python Services ============
  stt-service:
    build: ./services/stt-service
    ports:
      - "5001:5001"
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      MINIO_ENDPOINT: minio:9000
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GOOGLE_APPLICATION_CREDENTIALS: /secrets/google-cloud.json
    volumes:
      - ./secrets:/secrets
      - /tmp/audio:/tmp/audio
    depends_on:
      - postgres
      - redis
      - minio
    deploy:
      resources:
        limits:
          memory: 4G

  ai-analytics:
    build: ./services/ai-analytics
    ports:
      - "5002:5002"
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      MINIO_ENDPOINT: minio:9000
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis
      - minio

  # ============ API Gateway ============
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - main-api
      - webhook-service

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 8.2 Nginx Configuration

```nginx
upstream main_api {
    server main-api:8080;
}

upstream webhook_service {
    server webhook-service:8081;
}

server {
    listen 80;
    server_name salesai.local;

    # Main API
    location /api/v1 {
        proxy_pass http://main_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Webhooks (must be fast)
    location /api/v1/webhooks {
        proxy_pass http://webhook_service;
        proxy_read_timeout 2s;
    }

    # Frontend (Next.js)
    location / {
        proxy_pass http://main_api;
    }
}
```

---

## 9. Error Handling & Retry Strategy

### 9.1 Retry Logic (BullMQ)

```typescript
// In webhook-service
const audioQueue = new Queue("audio_processing", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s, 10s, 20s
    },
  },
});
```

### 9.2 Error Logging

Every service logs to `processing_logs` table:

```python
def log_error(call_id, service_name, error_message, retry_count):
    db.execute("""
        INSERT INTO logs_schema.processing_logs
        (call_id, service_name, status, error_message, retry_count)
        VALUES (%s, %s, 'error', %s, %s)
    """, (call_id, service_name, error_message, retry_count))
```

### 9.3 Dead Letter Queue

After 3 failed retries:

1. Update call status to `'error'`
2. Send notification to admin
3. Store in `processing_logs` with final error

---

## 10. Security Considerations

### 10.1 Authentication Flow

```
1. User logs in → Main API generates JWT
2. JWT contains: {user_id, company_id, role}
3. Every request includes: Authorization: Bearer <token>
4. Middleware validates JWT and extracts company_id
5. All DB queries filter by company_id (multi-tenancy isolation)
```

### 10.2 RBAC Enforcement

```go
// middleware/rbac.go
func RequireRole(allowedRoles ...string) fiber.Handler {
    return func(c *fiber.Ctx) error {
        userRole := c.Locals("role").(string)

        if !contains(allowedRoles, userRole) {
            return c.Status(403).JSON(fiber.Map{
                "error": "Forbidden: insufficient permissions"
            })
        }

        return c.Next()
    }
}

// Usage
app.Get("/api/v1/analytics/team-performance",
    middleware.RequireRole("tenant_admin", "super_admin"),
    handlers.GetTeamPerformance)
```

### 10.3 Data Isolation

```go
// Every query MUST include company_id
func (r *CallRepository) GetCallsByManager(companyID, managerID string) ([]Call, error) {
    query := `
        SELECT * FROM calls_schema.calls
        WHERE company_id = $1 AND manager_id = $2
    `
    // CRITICAL: Never omit company_id filter
}
```

---

## 11. Performance Optimizations

### 11.1 Database Indexing

Already included in schema:

- `idx_calls_company` (company_id)
- `idx_calls_manager` (manager_id)
- `idx_calls_status` (status)
- `idx_calls_date` (call_date)

### 11.2 Audio Processing

- Download audio to `/tmp` (SSD)
- Process in-memory where possible
- Delete immediately after transcription
- Use streaming for large files

### 11.3 Caching Strategy

```python
# Cache company settings (STT/LLM preferences)
@cache(ttl=3600)  # 1 hour
def get_company_settings(company_id):
    return db.fetch_one("SELECT * FROM companies WHERE id = %s", company_id)
```

---

## 12. Monitoring & Observability (Future)

### 12.1 Metrics to Track

- API response times (P50, P95, P99)
- Queue depth (BullMQ)
- STT processing time
- LLM API latency
- Error rates per service
- Database query performance

### 12.2 Logging Strategy

```
All services → stdout → Docker logs → (Future: ELK Stack)
```

**Log Format:**

```json
{
  "timestamp": "2026-02-08T10:30:00Z",
  "service": "stt-service",
  "level": "INFO",
  "call_id": "uuid",
  "message": "Transcription completed",
  "duration_ms": 45000
}
```

---

## 13. Development Workflow

### 13.1 Local Setup

```bash
# Clone repo
git clone https://github.com/your-org/salesai.git
cd salesai

# Start infrastructure
docker-compose up -d postgres redis minio

# Run migrations
cd services/main-api
go run cmd/migrate/main.go

# Start services (in separate terminals)
cd services/main-api && go run cmd/api/main.go
cd services/stt-service && python main.py
cd services/ai-analytics && python main.py
```

### 13.2 Testing Strategy

**Unit Tests:**

- Go: `go test ./...`
- Python: `pytest`

**Integration Tests:**

- Test full pipeline with mock audio file
- Verify end-to-end: Webhook → STT → AI → DB

**Load Tests:**

- Simulate 100 concurrent webhook calls
- Measure queue processing throughput

---

## 14. Diploma Compliance Matrix

| Requirement        | Implementation                                                            | Status |
| ------------------ | ------------------------------------------------------------------------- | ------ |
| **Auth & RBAC**    | JWT + 3 roles (Super Admin, Tenant Admin, Sales Rep)                      | ✅     |
| **Multi-page UI**  | 7+ pages (Dashboard, Calls, Analytics, Scripts, Settings, Profile, Admin) | ✅     |
| **Backend System** | 6 microservices (Go + Python)                                             | ✅     |
| **Complex Logic**  | AI pipeline (STT + LLM + KPI calculation) + Script matching               | ✅     |
| **Architecture**   | Microservices + Event-Driven + Clean Architecture                         | ✅     |
| **Connectivity**   | API ↔ DB ↔ Queue ↔ AI Services ↔ External CRM                             | ✅     |
| **Scale**          | 9 tables, 25+ endpoints, 6 services                                       | ✅     |
| **UX/UI**          | Loading states, real-time status, interactive transcript player           | ✅     |
| **Engineering**    | Docker, gRPC, Multi-tenancy, Retry logic, Error handling                  | ✅     |

---

## 15. Next Steps

1. **Review & Approve** this architecture document
2. **Generate folder structures** for each service with Clean Architecture
3. **Define API contracts** (OpenAPI/Swagger specs)
4. **Create database migrations** (SQL scripts)
5. **Build MVP**: Main API + Webhook + STT service
6. **Iterate**: Add Analytics, Sheets Sync, Script Management

---

**Document Prepared By:** Architecture Team  
**Last Updated:** February 8, 2026  
**Version:** 1.0  
**Status:** ✅ Approved for Implementation
