# SalesAI - Service Architecture Documentation

**Version:** 2.0  
**Date:** February 2026  
**Status:** Implementation Verified

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Service Inventory](#service-inventory)
3. [Service Architecture Details](#service-architecture-details)
4. [Infrastructure Components](#infrastructure-components)
5. [Communication Patterns](#communication-patterns)
6. [Technology Stack](#technology-stack)

---

## 1. System Overview

SalesAI is an Intelligent Revenue Intelligence & Coaching SaaS platform that processes call recordings through speech-to-text and AI analytics to provide performance insights for sales teams.

### 1.1 Architecture Pattern

- **Pattern**: Microservices with Event-Driven Architecture
- **Communication**: 
  - REST (HTTP) for client-facing APIs
  - gRPC for Go↔Python inter-service calls
  - WebSocket for real-time notifications
  - Redis Streams for event-driven AI pipeline
- **Queue**: BullMQ (Redis-backed)
- **Storage**: PostgreSQL + MinIO (S3-compatible)

---

## 2. Service Inventory

| Service | Language | Port | Protocol | Responsibility |
|---------|----------|------|----------|----------------|
| **Main API** | Golang (Fiber) | 8080 | HTTP/gRPC | Auth, CRUD, Analytics, WebSocket hub |
| **Sipuni Listener** | Golang (Fiber) | 8081 | WebSocket | Sipuni event ingestion, job queuing |
| **Script Service** | Golang (Fiber) | 8083 | HTTP | Script upload, parsing, storage |
| **STT Service** | Python (FastAPI) | 5001* | gRPC | Speech-to-text processing |
| **AI Analytics** | Python (FastAPI) | 5002* | gRPC | LLM-based call analysis |
| **Sheets Sync** | Golang | - | - | Google Sheets synchronization |
| **Frontend** | React/Vite | 80* | HTTP | Web UI (via Nginx) |

*Internal ports (not exposed outside docker network)

---

## 3. Service Architecture Details

### 3.1 Main API Service

**Technology**: Golang 1.22 + Fiber v2.52  
**Port**: 8080  
**Protocol**: HTTP REST + gRPC Client + WebSocket

#### Responsibilities
- User authentication (JWT-based)
- RBAC enforcement (Admin/Director/Rep)
- CRUD operations for calls, users, companies
- Analytics aggregation endpoints
- Real-time notifications via WebSocket
- gRPC communication with Python services

#### Clean Architecture Structure
```
services/main-api/
├── cmd/api/
│   └── main.go                    # Entry point
├── internal/
│   ├── adapters/
│   │   ├── events/               # Redis consumer for notifications
│   │   ├── grpc/                 # gRPC clients (STT, Analytics)
│   │   ├── http/
│   │   │   ├── handlers/         # HTTP controllers
│   │   │   ├── middleware/       # JWT, RBAC, Logging
│   │   │   ├── routes.go         # Route registration
│   │   │   └── ws/               # WebSocket hub
│   │   └── repositories/        # PostgreSQL implementations
│   ├── core/
│   │   ├── domain/               # Entities (User, Call, Company)
│   │   ├── ports/                # Interfaces
│   │   └── usecases/             # Business logic
│   └── infrastructure/
│       ├── config/               # Configuration loading
│       ├── database/             # PostgreSQL connection, migrations
│       └── security/             # JWT service
├── docs/                         # Swagger documentation
└── go.mod
```

#### Key Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/calls` - List calls (filters: manager_id, date_range, status)
- `GET /api/v1/calls/:id` - Get call details
- `GET /api/v1/calls/:id/transcript` - Get transcript
- `GET /api/v1/calls/:id/analysis` - Get analysis report
- `GET /api/v1/analytics/team-performance` - Team performance metrics
- `GET /api/v1/analytics/leaderboard` - Leaderboard data
- `GET /api/v1/companies/:id/settings` - Company settings
- `PUT /api/v1/companies/:id/settings` - Update settings
- `WS /api/v1/ws` - WebSocket for real-time notifications

---

### 3.2 Sipuni Listener Service

**Technology**: Golang 1.22 + Fiber v2.52  
**Port**: 8081  
**Protocol**: WebSocket (client) + HTTP (metrics)

#### Responsibilities
- Maintain persistent WebSocket connection to Sipuni (`wss://wss.sipuni.com/api`)
- Authenticate with Sipuni API key
- Receive call events (ringing, answered, completed)
- Parse call metadata (direction, manager, phone, recording URL)
- Create call records in PostgreSQL
- Enqueue audio processing jobs to BullMQ

#### Clean Architecture Structure
```
services/sipuni-listener/
├── cmd/listener/
│   └── main.go                    # Entry point with WebSocket loop
├── internal/
│   ├── adapters/
│   │   ├── http/                  # Metrics server
│   │   ├── queue/                # BullMQ publisher
│   │   └── repositories/          # PostgreSQL call repository
│   └── core/
│       ├── domain/                # Call entity
│       └── usecases/              # Event handling logic
├── internal/adapters/websocket/   # (referenced but not shown)
└── go.mod
```

#### Event Processing Flow
1. Connect to Sipuni WebSocket
2. Send auth message: `{"type":"auth","body":{"key":"<API_KEY>"}}`
3. Listen for `notify` events with call data
4. Extract: call_id, direction, from, to, record_url, timestamps
5. Create call record in PostgreSQL
6. Enqueue job to BullMQ: `audio_processing`

#### Incoming Event Format (Sipuni)
```
json
{
  "type": "event",
  "action": "notify",
  "namespace": "api",
  "request": {
    "call_id": "external-sipuni-id",
    "event": "5",
    "dst_num": "222",
    "src_num": "77081996454",
    "timestamp": "1694535780",
    "user_id": "manager-123",
    "status": "completed",
    "call_start_timestamp": "1694535600",
    "call_record_link": "https://files.sipuni.com/.../record.mp3"
  }
}
```

#### BullMQ Job Format
```
json
{
  "job_type": "audio_processing",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "audio_url": "https://...",
  "manager_id": "manager-123",
  "retry_count": 0,
  "max_retries": 3
}
```

---

### 3.3 Script Service

**Technology**: Golang 1.22 + Fiber  
**Port**: 8083  
**Protocol**: HTTP REST

#### Responsibilities
- Upload script files (DOCX/PDF) to MinIO
- Parse text content from documents
- Store parsed text in PostgreSQL
- Provide retrieval API for AI service

#### Clean Architecture Structure
```
services/script-service/
├── cmd/script/
│   └── main.go                    # Entry point
├── internal/
│   ├── adapters/
│   │   ├── http/handlers/         # Upload, List, Download, Delete
│   │   ├── repositories/          # PostgreSQL script repository
│   │   └── storage/               # MinIO client
│   └── core/
│       ├── domain/                # Script entity
│       └── usecases/              # Business logic
├── scripts/                       # Python parsers
│   ├── parse_docx.py
│   └── parse_pdf.py
└── go.mod
```

#### Key Endpoints
- `POST /api/v1/scripts` - Upload script (multipart form)
- `GET /api/v1/scripts/:company_id` - List scripts for company
- `GET /api/v1/scripts/:id/download` - Download script file
- `DELETE /api/v1/scripts/:id` - Delete script

---

### 3.4 STT Service

**Technology**: Python 3.11 + FastAPI  
**Internal Port**: 5001 (gRPC)  
**Protocol**: gRPC Server + BullMQ Consumer

#### Responsibilities
- Consume BullMQ jobs from `audio_processing` queue
- Download audio from URL
- Convert audio to 16kHz WAV format
- Run speaker diarization (Pyannote)
- Run speech-to-text:
  - **Local**: WhisperX
  - **Cloud**: OpenAI Whisper API or Google Gemini STT
- Save transcript to PostgreSQL
- Emit `transcript_ready` event to Redis Stream

#### Clean Architecture Structure
```
services/stt-service/
├── main.py                        # Entry point
├── src/
│   ├── adapters/
│   │   ├── queue/                # BullMQ consumer
│   │   ├── storage/              # MinIO, PostgreSQL clients
│   │   └── events/               # Redis publisher
│   ├── core/
│   │   ├── domain/               # Transcript, Audio entities
│   │   ├── ports/                # STT, Diarization provider interfaces
│   │   └── usecases/             # Audio processing logic
│   ├── infrastructure/
│   │   ├── stt/                  # WhisperX, OpenAI, Gemini implementations
│   │   ├── diarization/          # Pyannote implementation
│   │   └── audio/                # Audio converter (16kHz WAV)
│   └── config/                   # Settings
├── requirements.txt
└── Dockerfile
```

#### Processing Flow
1. Receive job from BullMQ queue
2. Fetch company settings (STT preference)
3. Download audio to `/tmp`
4. Convert to 16kHz WAV
5. Run speaker diarization (Pyannote)
6. Run STT (WhisperX/OpenAI/Gemini based on config)
7. Merge diarization + transcript
8. Save transcript JSON to PostgreSQL
9. Delete audio from `/tmp`
10. Publish `transcript_ready` event to Redis Stream

#### Environment Variables
- `STT_PROVIDER` - "openai" | "gemini" | "local"
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_API_KEY` - Google API key
- `GOOGLE_AI_MODEL` - Google STT model name

---

### 3.5 AI Analytics Service

**Technology**: Python 3.11 + FastAPI  
**Internal Port**: 5002 (gRPC)  
**Protocol**: gRPC Server + Redis Stream Consumer

#### Responsibilities
- Consume `transcript_ready` events from Redis Stream
- Fetch transcript + script from database
- Run LLM analysis:
  - **OpenAI**: GPT-4 based analysis
  - **Google Gemini**: Gemini Pro based analysis
- Calculate metrics:
  - Quality score
  - Script match percentage
  - Error detection
  - Talk time ratios
- Compute KPI using predefined formula
- Save analysis report to PostgreSQL
- (Optional) Push results to AmoCRM

#### Clean Architecture Structure
```
services/ai-analytics/
├── main.py                        # Entry point
├── src/
│   ├── adapters/
│   │   ├── events/                # Redis Stream consumer
│   │   ├── storage/               # MinIO, PostgreSQL clients
│   │   └── crm/                  # AmoCRM client
│   ├── core/
│   │   ├── domain/                # AnalysisReport, Metrics entities
│   │   ├── ports/                # LLM provider interface
│   │   └── usecases/             # Analysis, KPI calculation
│   ├── infrastructure/
│   │   ├── llm/                  # OpenAI, Gemini clients
│   │   └── prompts/              # System prompts, scoring rubrics
│   └── config/                   # Settings
├── requirements.txt
└── Dockerfile
```

#### Analysis Metrics
- **Quality Score**: Overall call quality (0-100)
- **Script Match**: Percentage of script followed
- **Talk Time Ratio**: Manager vs client talk time
- **Error Count**: Number of deviations/errors
- **KPI**: Computed composite score

---

### 3.6 Sheets Sync Service

**Technology**: Golang 1.24  
**Protocol**: Scheduled (Cron-like)

#### Responsibilities
- Sync data to Google Sheets
- Periodic data export

---

### 3.7 Frontend Service

**Technology**: React 18 + Vite + TypeScript  
**Port**: 80 (via Nginx)  
**Protocol**: HTTP

#### Structure
```
services/frontend/
├── src/
│   ├── app/                       # App configuration, providers
│   ├── entities/                  # Domain entities (API interfaces)
│   │   ├── analytics/
│   │   ├── call/
│   │   ├── company/
│   │   ├── integration/
│   │   ├── notification/
│   │   ├── script/
│   │   ├── team/
│   │   └── user/
│   ├── features/                  # Feature modules
│   │   ├── auth/
│   │   ├── integrations/
│   │   └── team-management/
│   ├── pages/                     # Page components
│   │   ├── CallsList/
│   │   ├── CallDetail/
│   │   ├── CompanySettings/
│   │   ├── Dashboard/
│   │   ├── Login/
│   │   ├── ScriptsList/
│   │   └── ...
│   ├── shared/                    # Shared utilities
│   │   ├── api/                   # API client
│   │   ├── ui/                    # UI components
│   │   └── utils/
│   └── widgets/                   # Reusable widgets
├── public/
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── Dockerfile
```

#### Pages
- Landing Page
- Login/Register
- User Dashboard
- Director Dashboard
- Calls List
- Call Detail
- Scripts List
- Script Upload
- Company Settings
- Team Management
- Integrations
- Notifications
- Leaderboard

---

## 4. Infrastructure Components

### 4.1 Container Orchestration

All services are orchestrated via Docker Compose:

| Component | Image | Port | Purpose |
|-----------|-------|------|---------|
| **PostgreSQL** | postgres:16-alpine | 5432 | Primary database |
| **Redis** | redis:7.2-alpine | 6379 | Queue, caching, streams |
| **MinIO** | minio/minio:latest | 9000/9001 | S3-compatible storage |
| **Nginx** | nginx:1.25-alpine | 80 | API Gateway |
| **Prometheus** | prom/prometheus:v2.45.0 | 9090 | Metrics collection |
| **Grafana** | grafana/grafana:10.0.3 | 3000 | Visualization |
| **Loki** | grafana/loki:2.8.2 | 3100 | Log aggregation |
| **Promtail** | grafana/promtail:2.8.2 | - | Log shipping |
| **cAdvisor** | gcr.io/cadvisor/cadvisor:v0.47.2 | 8082 | Container metrics |
| **Redis Exporter** | oliver006/redis_exporter:v1.52.0 | 9121 | Redis metrics |
| **BullMQ Exporter** | igrek8/bullmq-prometheus | 3000 | Queue metrics |

### 4.2 Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network (sale1-network)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐   ┌────────────┐   ┌───────────┐             │
│  │Frontend  │   │ Main API   │   │  Nginx    │             │
│  │  :80     │   │  :8080     │   │   :80     │             │
│  └────┬─────┘   └─────┬──────┘   └─────┬─────┘             │
│       │              │                │                    │
│       └──────────────┼────────────────┘                    │
│                      │                                      │
│       ┌──────────────┼────────────────┐                    │
│       │              │                │                    │
│  ┌────┴─────┐  ┌─────┴──────┐  ┌─────┴─────┐             │
│  │ Script   │  │  Sipuni    │  │ STT Svc   │             │
│  │ Service  │  │ Listener   │  │  :5001    │             │
│  │ :8083    │  │  :8081     │  │           │             │
│  └────┬─────┘  └─────┬──────┘  └─────┬─────┘             │
│       │              │                │                    │
│       └──────────────┼────────────────┘                    │
│                      │                                      │
│         ┌────────────┼────────────────┐                   │
│         │            │                │                   │
│    ┌────┴─────┐ ┌────┴─────┐    ┌─────┴─────┐            │
│    │PostgreSQL│ │  Redis   │    │  MinIO    │            │
│    │  :5432   │ │  :6379   │    │ :9000     │            │
│    └──────────┘ └──────────┘    └───────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Communication Patterns

### 5.1 Synchronous Communication (Request-Response)

```
Client → Nginx → Main API (8080) → PostgreSQL
Client → Nginx → Script Service (8083) → MinIO
```

### 5.2 gRPC Communication

```
Main API (Go)  ────gRPC───→  STT Service (Python)
Main API (Go)  ────gRPC───→  AI Analytics (Python)
```

### 5.3 Event-Driven Communication

```
Sipuni Listener (WebSocket)
        ↓
    PostgreSQL (Call record)
        ↓
    BullMQ Queue (Audio processing job)
        ↓
    STT Service (Process audio)
        ↓
    Redis Stream (transcript_ready event)
        ↓
    AI Analytics (Analyze transcript)
        ↓
    PostgreSQL (Analysis report)
        ↓
    WebSocket (Notify client)
```

---

## 6. Technology Stack

### 6.1 Programming Languages & Frameworks

| Service | Language | Framework | Version |
|---------|----------|-----------|---------|
| Main API | Go | Fiber | 1.22 / 2.52 |
| Sipuni Listener | Go | Fiber | 1.22 / 2.52 |
| Script Service | Go | Fiber | 1.22 / 2.52 |
| Sheets Sync | Go | - | 1.24 |
| STT Service | Python | FastAPI | 3.11 / 0.109 |
| AI Analytics | Python | FastAPI | 3.11 / 0.109 |
| Frontend | TypeScript | React/Vite | 18.x |

### 6.2 Infrastructure

| Component | Technology | Version |
|-----------|------------|---------|
| Database | PostgreSQL | 16 |
| Queue/Cache | Redis | 7.2 |
| Object Storage | MinIO | RELEASE.2024-01-01 |
| API Gateway | Nginx | 1.25 |
| Containerization | Docker + Compose | 24.0 / 2.23 |
| Metrics | Prometheus | 2.45.0 |
| Visualization | Grafana | 10.0.3 |
| Log Aggregation | Loki | 2.8.2 |

### 6.3 External Integrations

| Service | Integration | Purpose |
|---------|-------------|---------|
| Sipuni | WebSocket | Call event ingestion |
| OpenAI | API | Whisper STT, GPT-4 Analysis |
| Google | API | Gemini STT, Gemini Analysis |
| AmoCRM | REST API | CRM synchronization (optional) |
| MinIO | S3 Protocol | File storage |

---

## Appendix A: Data Flow Summary

### Call Processing Pipeline

```
1. Sipuni ( telephony ) ──WebSocket event──→ Sipuni Listener
2. Sipuni Listener ──Create call──→ PostgreSQL
3. Sipuni Listener ──Enqueue job──→ BullMQ (Redis)
4. BullMQ ──Consume job──→ STT Service
5. STT Service ──Download audio──→ External URL
6. STT Service ──Convert audio──→ 16kHz WAV
7. STT Service ──Diarize──→ Pyannote
8. STT Service ──Transcribe──→ WhisperX/OpenAI/Gemini
9. STT Service ──Save transcript──→ PostgreSQL
10. STT Service ──Publish event──→ Redis Stream
11. Redis Stream ──Consume event──→ AI Analytics
12. AI Analytics ──Fetch transcript──→ PostgreSQL
13. AI Analytics ──Fetch script──→ PostgreSQL/MinIO
14. AI Analytics ──LLM Analysis──→ OpenAI/Gemini
15. AI Analytics ──Calculate KPI──→ Internal
16. AI Analytics ──Save report──→ PostgreSQL
17. AI Analytics ──Notify──→ Redis Pub/Sub
18. Redis Pub/Sub ──Consume──→ Main API WebSocket Hub
19. WebSocket Hub ──Broadcast──→ Client
```

---

## Appendix B: API Gateway Routes (Nginx)

```
/                   → Frontend (:80)
/api/v1/*           → Main API (:8080)
/api/v1/scripts/*   → Script Service (:8083)
/api/v1/webhooks/*  → Sipuni Listener (:8081)
