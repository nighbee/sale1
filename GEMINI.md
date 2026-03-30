# SalesAI - Project Context & Instructions

**SalesAI** is a polyglot microservices B2B SaaS platform designed to automate Quality Assurance (QA) for sales teams. It ingests communication data from telephony providers (e.g., Sipuni), transcribes audio using AI (Whisper), and analyzes content using Google Gemini (gemini-3-flash-preview) to provide performance scores and coaching insights.

## 🏗 System Architecture

The project follows a **Microservices Architecture** with an **Event-Driven AI Pipeline**.

### Core Services
- **Main API (`services/main-api`)**: Golang (Fiber). Handles User Auth (JWT/RBAC), CRUD for calls/companies, and Analytics aggregation.
- **Sipuni Listener (`services/sipuni-listener`)**: Golang. Persistent WebSocket connection to Sipuni for real-time call event ingestion.
- **Script Service (`services/script-service`)**: Golang. Manages sales scripts (DOCX/PDF upload to MinIO, parsing via Python scripts).
- **STT Service (`services/stt-service`)**: Python (FastAPI). Consumes BullMQ jobs to transcribe audio using Whisper (local/cloud) or Gemini STT.
- **AI Analytics (`services/ai-analytics`)**: Python (FastAPI). Runs LLM analysis on transcripts against sales scripts to compute KPIs.
- **Sheets Sync (`services/sheets-sync`)**: Python. Synchronizes call data and analysis results with Google Sheets.
- **Frontend (`services/frontend`)**: React (Vite/TypeScript). Dashboard, "Karaoke" call player, and management UI.

### Infrastructure Stack
- **Database**: PostgreSQL 16 (Multi-schema: `auth`, `calls`, `scripts`, etc.).
- **Queue**: Redis 7.2 with **BullMQ** for async job processing.
- **Storage**: **MinIO** (S3-compatible) for audio recordings and script files.
- **Gateway**: Nginx as a reverse proxy and rate limiter.
- **Monitoring**: Prometheus, Grafana, Loki, and Promtail for logs and metrics.

## 🚀 Building and Running

### Prerequisites
- Docker Desktop & Docker Compose
- Go 1.22+
- Python 3.11+
- Node.js 18+

### Quick Start (Local)
1. **Infrastructure**: `docker-compose up -d postgres redis minio`
2. **Migrations**: 
   ```bash
   cd services/main-api
   go run cmd/migrate/main.go
   ```
3. **Start All**: `docker-compose up -d`
4. **Access**:
   - Frontend: `http://localhost:5173` (via Vite) or `http://localhost` (via Nginx)
   - API: `http://localhost:8080/api/v1`
   - MinIO Console: `http://localhost:9001` (minioadmin/minioadmin123)

### Service-Specific Development
- **Frontend**: `cd services/frontend; npm install; npm run dev`
- **Main API**: `cd services/main-api; go run cmd/api/main.go`
- **STT Service**: `cd services/stt-service; pip install -r requirements.txt; python main.py`

## 🛠 Development Conventions

### Clean Architecture
Both Go and Python services strictly adhere to **Clean Architecture** principles:
- **Core/Domain**: Entities and business logic.
- **Core/UseCases**: Application-specific business rules.
- **Adapters**: HTTP handlers, gRPC clients, and Repository implementations.
- **Infrastructure**: Config, Database connections, and Logging.

### Frontend Architecture
The frontend uses **Feature-Sliced Design (FSD)**:
- `app/`: Global configuration and providers.
- `pages/`: Full screen views.
- `widgets/`: Complex compositions (e.g., Navbar, CallTable).
- `features/`: Interactive user actions (e.g., UploadScript).
- `entities/`: Domain models (e.g., User, Call, Transcript).
- `shared/`: Reusable UI components and utilities.

### Database Strategy
- **Multi-Schema Isolation**: `auth_schema`, `calls_schema`, `scripts_schema`.
- **Tenancy**: Every query must be scoped by `company_id`.

## 📝 Important Notes for Gemini
- **Commands**: On Windows, use `;` for sequential execution, not `&&`.
- **Migrations**: Always verify database state before adding new entities.
- **AI Services**: STT and Analytics services depend on BullMQ/Redis; ensure Redis is healthy when testing these pipelines.
- **Environment**: Use `.env` file at root for API keys (OpenAI, Gemini, Sipuni).
