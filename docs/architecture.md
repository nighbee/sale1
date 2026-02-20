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
│                         CLIENT LAYER                               │
│  ┌──────────────┐     ┌──────────────┐      ┌──────────────┐       │
│  │   Web App    │     │  Mobile App  │      │ External CRM │       │
│  │ (Next.js)    │     │  (React)     │      │  (AmoCRM)    │       │
│  └──────┬───────┘     └──────┬───────┘      └──────┬───────┘       │
└─────────┼────────────────────┼─────────────────────┼────────────────┘
          │                    │                     │
          ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (NGINX)                           │
└─────────────────────────────────────────────────────────────────────┘
          │
          ├──────────────┬──────────────────────────────┬────────────┐
          ▼              ▼                              ▼            ▼
┌──────────────┐ ┌──────────────────┐           ┌──────────────┐ ┌──────────────┐
│  Main API    │ │ Sipuni WS        │           │   Script     │ │              │
│  Service     │ │ Listener Service │           │  Management  │ │  (Golang)    │
│  (Golang)    │ │  (Golang)        │           │  (Python) │ │              │
└──────┬───────┘ └──────────┬───────┘           └──────┬───────┘ └──────────────┘
       │                    │                          │
       │                    └──────────────┬───────────┘
       │                                   │
       │                                   ▼
       │                          ┌──────────────────┐
       │                          │   BullMQ Queue   │
       │                          │     (Redis)      │
       │                          └────────┬─────────┘
       │                                   │
       │                        ┌──────────┴──────────┐
       │                        ▼                     ▼
       │                 ┌──────────────┐     ┌──────────────┐
       │                 │ STT Service  │     │ AI Analytics │
       │                 │  (Python)    │────▶│   Service    │
       │                 │              │Event│  (Python)    │
       │                 └──────┬───────┘     └──────┬───────┘
       │                        │                    │
       │                        │                    │
       └────────────────────────┴────────────────────┘
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

| Service               | Language    | Port | Responsibility                                   | Clean Architecture |
| --------------------- | ----------- | ---- | ------------------------------------------------ | ------------------ |
| **Main API**          | Golang      | 8080 | Auth, CRUD, Analytics APIs                       | ✅                 |
| **Sipuni Listener**   | Golang      | 8081 | Maintain WS to Sipuni, enqueue call jobs         | ✅                 |
| **Script Service**    | Golang      | 8083 | Upload, parse, store scripts                     | ✅                 |
| **STT Service**       | Python      | 5001 | Speech-to-Text processing                        | ✅                 |
| **AI Analytics**      | Python      | 5002 | LLM-based call analysis and KPI computation      | ✅                 |

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

#### **Service 2: Sipuni Listener (Golang)**

**Responsibilities:**

- Maintain a persistent WebSocket connection to Sipuni at `wss://wss.sipuni.com/api`.
- Send an AUTH message after connect in the format: `{"type":"auth","body":{"key":"<SIPUNI_API_KEY>"}}`.
- Receive call events with `"action":"notify"` and `"namespace":"api"`, parse call metadata (direction, manager, phone, Sipuni `call_id`, recording URL, etc.).
- For completed calls, create or update the base call record in PostgreSQL and push an `audio_processing` job to the BullMQ queue.

**Clean Architecture:**

```
sipuni-listener/
├── cmd/
│   └── listener/
│       └── main.go
├── internal/
│   ├── adapters/
│   │   ├── websocket/      # Sipuni WS client
│   │   │   └── sipuni_client.go
│   │   └── queue/          # BullMQ / Redis publisher
│   │       └── audio_queue.go
│   ├── core/
│   │   ├── domain/
│   │   │   └── sipuni_event.go
│   │   └── usecases/
│   │       └── handle_event.go
│   └── infrastructure/
│       └── config/
└── pkg/
    └── dto/
        └── sipuni_payload.go
```

**Incoming Event (Sipuni, simplified):**

```json
{
  "type": "event",
  "action": "notify",
  "namespace": "api",
  "request": {
    "call_id": "external-sipuni-id",
    "direction": "inbound",
    "from": "77081996454",
    "to": "222",
    "record_url": "https://files.sipuni.com/.../record.mp3",
    "timestamp": "2025-09-12T17:43:00Z"
  }
}
```

**BullMQ Queue Job (unchanged):**

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

#### **Service 3: Script Management (Golang)**

**Responsibilities:**

- Upload script files (DOCX/PDF) to MinIO
- Parse text content using Python scripts (subprocess)
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
│   │   └── repositories/
│   │       └── script_repo.go
│   ├── core/
│   │   ├── domain/
│   │   │   └── script.go
│   │   ├── ports/
│   │   │   └── script_repository.go
│   │   └── usecases/
│   │       ├── upload_script.go
│   │       └── parse_script.go
│   └── infrastructure/
│       ├── config/
│       └── logger/
└── scripts/                # Python parsers
    ├── parse_docx.py
    └── parse_pdf.py
```
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


---

## 3. Data Flow Diagrams

### 3.1 Call Processing Pipeline (Happy Path)

```
┌─────────────┐
│  Sipuni     │ (WebSocket events)
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Sipuni Listener (Go) │ (Auth, normalize event, generate call_id)
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

## 4. Database Schema

### 4.1 PostgreSQL Schema Design

**Multi-Schema Approach:**

- `auth_schema`: companies, users
- `calls_schema`: calls, transcripts, analysis_reports
- `scripts_schema`: scripts
- `integrations_schema`: integrations
- `logs_schema`: processing_logs, notifications

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


## 7. Technology Stack

### 7.1 Services Stack

| Component             | Technology            | Version      |
| --------------------- | --------------------- | ------------ |
| **Main API**          | Golang (Fiber)        | 1.22 / 2.52  |
| **Sipuni Listener**   | Golang (Fiber)        | 1.22 / 2.52  |
| **Script Service**    | Golang (Fiber)        | 1.22 / 2.52  |
| **Sheets Sync**       | Golang                | 1.24         |
| **STT Service**       | Python (FastAPI)      | 3.11 / 0.109 |

### 7.2 Infrastructure Stack

| Component            | Technology           | Version            |
| -------------------- | -------------------- | ------------------ |
| **Database**         | PostgreSQL           | 16                 |
| **Queue**            | Redis + BullMQ       | 7.2                |
| **Object Storage**   | MinIO                | RELEASE.2024-01-01 |
| **API Gateway**      | Nginx                | 1.25               |
| **Containerization** | Docker + Compose     | 24.0 / 2.23        |
| **Monitoring**       | Grafana + Prometheus | (Phase 2)          |

