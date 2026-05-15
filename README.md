# SalesAI

SalesAI is a polyglot microservices B2B SaaS platform for automated sales call QA.  
It ingests call events, transcribes audio, analyzes transcript quality with LLMs, and exposes analytics to a web dashboard.

---

## 1) What this repository contains

This repo includes:

- **Core production services** (`services/*`)
- **Infrastructure and deployment config** (`docker-compose.yml`, `nginx/`, `monitoring/`)
- **Architecture and operational docs** (`docs/`)
- **Auxiliary/experimental tooling** (`services/sipuni-downloader`, `ai-services/stt-local`)

---

## 2) High-level architecture

```text
Sipuni (WS events)
   │
   ▼
sipuni-listener (Go) ──► PostgreSQL (calls)
   │
   └──► Redis/BullMQ (audio_processing job)
               │
               ▼
          stt-service (Python)
               │
               ├──► PostgreSQL (transcripts)
               └──► Redis event (transcript_ready)
                           │
                           ▼
                    ai-analytics (Python)
                           │
                           └──► PostgreSQL (analysis_reports)

Frontend (React) ─► Nginx ─► main-api/script-service/sipuni-listener
                         └► WebSocket updates via main-api
```

---

## 3) Service inventory

### Core services in `services/`

| Service | Stack | Default Port | Role | Path |
|---|---|---:|---|---|
| main-api | Go + Fiber | 8080 | Auth, RBAC, CRUD, analytics aggregation, realtime hub | `services/main-api` |
| sipuni-listener | Go | 8081 | Persistent Sipuni WS ingest, call creation, queue producer | `services/sipuni-listener` |
| script-service | Go + Fiber | 8083 | Script upload/list/download/delete, MinIO-backed storage | `services/script-service` |
| stt-service | Python + FastAPI | internal `:8001` (not host-published) | Audio download, STT processing, transcript persistence | `services/stt-service` |
| ai-analytics | Python + FastAPI | internal `:8001` (not host-published) | LLM analysis and KPI/report generation | `services/ai-analytics` |
| frontend | React + Vite + TS | 80 (via nginx) / 5173 (dev) | Web dashboard and workflows | `services/frontend` |

### Additional components

| Component | Status | Notes | Path |
|---|---|---|---|
| sheets-sync | Documented/planned | Service docs exist, but a runnable service directory is not yet present under `services/` | `docs/services/sheets-sync.md` |
| sipuni-downloader | Utility/experimental | TypeScript scripts for reliable Sipuni record download testing | `services/sipuni-downloader` |
| stt-local | Auxiliary | Standalone local FastAPI Whisper-based STT app | `ai-services/stt-local` |

---

## 4) Infrastructure stack

- **Database:** PostgreSQL 16
- **Queue/Event backbone:** Redis 7.2 + BullMQ
- **Object storage:** MinIO (S3-compatible)
- **Gateway:** Nginx
- **Observability:** Prometheus, Grafana, Loki, Promtail, cAdvisor, Redis exporter, BullMQ exporter

See:
- `docker-compose.yml`
- `docs/monitoring.md`
- `docs/deployment.md`

---

## 5) Core data flow (call lifecycle)

1. `sipuni-listener` receives Sipuni event.
2. Call record is created in PostgreSQL (`calls_schema.calls`).
3. `audio_processing` job is queued in Redis/BullMQ.
4. `stt-service` consumes job, transcribes audio, writes transcript.
5. `transcript_ready` event triggers `ai-analytics`.
6. `ai-analytics` generates structured analysis report and KPI.
7. `main-api` serves/aggregates data for frontend and realtime updates.

---

## 6) Quick start (Docker)

From repo root:

> Windows note: these examples are shown as separate lines; if you rewrite them as a single line, use PowerShell with `;` for sequential execution (project convention).

```bash
# 1) Start infra
docker-compose up -d postgres redis minio

# 2) Run DB migrations
cd services/main-api
go run cmd/migrate/main.go
cd ../..

# 3) Start all services
docker-compose up -d

# 4) Check status
docker-compose ps
```

Useful endpoints:

- App (via Nginx): `http://localhost`
- Main API health: `http://localhost:8080/api/v1/health`
- Sipuni Listener health: `http://localhost:8081/health`
- Script Service health: `http://localhost:8083/health`
- MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin123`)
- Grafana: `http://localhost:3000` (`admin` / `admin` by default)

---

## 7) Local development (service-by-service)

### Frontend

```bash
cd services/frontend
npm install
npm run dev
```

### Main API

```bash
cd services/main-api
go run cmd/api/main.go
```

### Sipuni Listener

```bash
cd services/sipuni-listener
go run cmd/listener/main.go
```

### Script Service

```bash
cd services/script-service
go run cmd/script/main.go
```

### STT Service

```bash
cd services/stt-service
pip install -r requirements.txt
python main.py
```

### AI Analytics

```bash
cd services/ai-analytics
pip install -r requirements.txt
python main.py
```

---

## 8) Environment variables (high-level)

Key variables used across services:

- `DATABASE_URL`
- `REDIS_URL`
- `LOG_LEVEL`
- `INTERNAL_SECRET`
- `JWT_SECRET` (main-api)
- `SIPUNI_API_KEY` (sipuni-listener)
- `OPENAI_API_KEY` (stt-service provider mode)
- `GOOGLE_API_KEY` (stt-service provider mode)
- `GROQ_API_KEY` (stt-service provider mode)
- `DEEPGRAM_API_KEY` (stt-service provider mode)
- `STT_PROVIDER` (stt-service provider selection)
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_PROVIDER`, `GEMINI_API_KEY` (ai-analytics)
- `MINIO_*` variables (main-api/script-service/stt-service + MinIO)

See detailed matrix: `docs/api_keys_requirement.md`

Port note: `stt-service` and `ai-analytics` both listen on internal container port `8001` in Docker Compose; this does not conflict because each container has its own isolated network namespace, and these ports are not host-published in `docker-compose.yml`. If you run both services directly on the host at the same time, use different host ports or run one service at a time.

---

## 9) Architecture conventions

- **Microservices + event-driven AI pipeline**
- **Clean Architecture** for backend services (Go and Python)
- **Feature-Sliced Design (FSD)** in frontend
- **Multi-tenant model:** `company_id`-scoped data access across domains

See:
- `docs/architecture.md`
- `docs/service-architecture.md`
- `docs/frontend-architecture.md`
- `docs/architecture/tenancy/`

---

## 10) Testing and validation commands

Observed runnable commands in this repo:

```bash
# Go services
cd services/main-api && go test ./...
cd services/sipuni-listener && go test ./...
cd services/script-service && go test ./...

# Frontend (requires npm install first)
cd services/frontend && npm run lint

# Python services (requires python deps + pytest installed)
cd services/stt-service && pytest -q
cd services/ai-analytics && pytest -q
```

---

## 11) Documentation map

- Service docs index: `docs/services/README.md`
- Service deep dives: `docs/services/*.md`
- API contract: `docs/api_contract.md`
- Monitoring: `docs/monitoring.md`
- Deployment: `docs/deployment.md`
- Database/migrations: `docs/database_initial_migration.md`
- Integration testing approach: `docs/integration-testing.md`

---

## 12) Repository structure (top level)

```text
services/        # Main microservices
ai-services/     # Auxiliary AI service(s)
docs/            # Architecture and operational documentation
monitoring/      # Prometheus/Grafana/Loki/Promtail configs
nginx/           # Gateway configuration
proto/           # Protocol definitions
docker-compose.yml
```
