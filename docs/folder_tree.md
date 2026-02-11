# SalesAI - Project Folder Structure

## Complete Directory Layout

```
sale1/
├── docker-compose.yml
├── .env.example
├── README.md
├── ARCHITECTURE.md
├── Makefile
│
├── proto/                          # Shared gRPC definitions
│   ├── stt_service.proto
│   ├── analytics_service.proto
│   └── generate.sh
│
├── scripts/                        # Deployment & utility scripts
│   ├── init-db.sql
│   ├── setup-minio.sh
│   └── run-migrations.sh
│
├── nginx/
│   └── nginx.conf
│
├── secrets/                        # Git-ignored
│   ├── google-sheets.json
│   └── google-cloud.json
│
└── services/
    ├── main-api/               # Golang - Main API Service
    ├── webhook-service/        # Golang - Webhook Ingestion
    ├── sheets-sync/            # Golang - Google Sheets Sync
    ├── script-service/         # Golang + Python - Script Management
    ├── stt-service/            # Python - Speech-to-Text
    └── ai-analytics/           # Python - AI Analysis
```

---

## Service 1: Main API (Golang)

```
services/main-api/
├── cmd/
│   ├── api/
│   │   └── main.go                     # Entry point
│   └── migrate/
│       └── main.go                     # Database migrations runner
│
├── internal/
│   ├── adapters/                       # Interface Adapters Layer
│   │   ├── http/                       # HTTP Controllers
│   │   │   ├── handlers/
│   │   │   │   ├── auth_handler.go
│   │   │   │   ├── user_handler.go
│   │   │   │   ├── call_handler.go
│   │   │   │   ├── company_handler.go
│   │   │   │   ├── analytics_handler.go
│   │   │   │   └── script_handler.go
│   │   │   ├── middleware/
│   │   │   │   ├── auth.go             # JWT validation
│   │   │   │   ├── rbac.go             # Role-based access
│   │   │   │   ├── tenant_isolation.go # Company ID injection
│   │   │   │   ├── logger.go
│   │   │   │   └── cors.go
│   │   │   ├── routes.go               # Route definitions
│   │   │   └── response.go             # Standard response helpers
│   │   │
│   │   ├── grpc/                       # gRPC Clients
│   │   │   ├── stt_client.go
│   │   │   └── analytics_client.go
│   │   │
│   │   └── repositories/               # Data Access Layer
│   │       ├── user_repository.go
│   │       ├── call_repository.go
│   │       ├── company_repository.go
│   │       ├── script_repository.go
│   │       ├── transcript_repository.go
│   │       ├── analysis_repository.go
│   │       └── notification_repository.go
│   │
│   ├── core/                           # Enterprise Business Rules
│   │   ├── domain/                     # Entities
│   │   │   ├── user.go
│   │   │   ├── company.go
│   │   │   ├── call.go
│   │   │   ├── transcript.go
│   │   │   ├── analysis_report.go
│   │   │   ├── script.go
│   │   │   └── notification.go
│   │   │
│   │   ├── ports/                      # Interfaces (Dependency Inversion)
│   │   │   ├── user_repository.go      # Interface definition
│   │   │   ├── call_repository.go
│   │   │   ├── auth_service.go
│   │   │   └── analytics_service.go
│   │   │
│   │   └── usecases/                   # Business Logic
│   │       ├── auth/
│   │       │   ├── register.go
│   │       │   ├── login.go
│   │       │   └── refresh_token.go
│   │       ├── calls/
│   │       │   ├── list_calls.go
│   │       │   ├── get_call_details.go
│   │       │   └── reprocess_call.go
│   │       ├── analytics/
│   │       │   ├── team_performance.go
│   │       │   └── leaderboard.go
│   │       └── users/
│   │           ├── invite_user.go
│   │           └── update_user.go
│   │
│   └── infrastructure/                 # Frameworks & Drivers
│       ├── config/
│       │   └── config.go               # Viper config loader
│       ├── database/
│       │   ├── postgres.go
│       │   └── migrations/
│       │       ├── 001_init_schema.sql
│       │       ├── 002_add_indexes.sql
│       │       └── ...
│       ├── logger/
│       │   └── logger.go               # Zerolog setup
│       └── security/
│           ├── jwt.go
│           └── password.go             # bcrypt hashing
│
├── pkg/                                # Shared packages
│   ├── dto/                            # Data Transfer Objects
│   │   ├── auth_dto.go
│   │   ├── call_dto.go
│   │   ├── user_dto.go
│   │   └── analytics_dto.go
│   ├── errors/
│   │   └── custom_errors.go
│   ├── validators/
│   │   └── validators.go
│   └── utils/
│       └── pagination.go
│
├── tests/
│   ├── integration/
│   │   └── auth_test.go
│   └── unit/
│       └── usecases_test.go
│
├── Dockerfile
├── go.mod
├── go.sum
└── README.md
```

---

## Service 2: Webhook & Ingestion (Golang)

```
services/webhook-service/
├── cmd/
│   └── webhook/
│       └── main.go
│
├── internal/
│   ├── adapters/
│   │   ├── http/
│   │   │   ├── handlers/
│   │   │   │   ├── amocrm_webhook.go
│   │   │   │   └── health.go
│   │   │   └── routes.go
│   │   │
│   │   ├── queue/                      # BullMQ Publisher
│   │   │   └── bullmq_publisher.go
│   │   │
│   │   └── repositories/
│   │       └── call_repository.go      # Minimal: just INSERT call record
│   │
│   ├── core/
│   │   ├── domain/
│   │   │   ├── webhook_event.go
│   │   │   └── audio_job.go
│   │   │
│   │   ├── ports/
│   │   │   ├── queue_publisher.go
│   │   │   └── call_repository.go
│   │   │
│   │   └── usecases/
│   │       ├── process_amocrm_webhook.go
│   │       └── enqueue_audio_job.go
│   │
│   └── infrastructure/
│       ├── config/
│       ├── database/
│       ├── redis/
│       │   └── client.go
│       └── logger/
│
├── pkg/
│   └── dto/
│       ├── amocrm_payload.go
│       └── job_payload.go
│
├── Dockerfile
├── go.mod
└── README.md
```

---

## Service 3: Google Sheets Sync (Golang)

```
services/sheets-sync/
├── cmd/
│   └── sync/
│       └── main.go
│
├── internal/
│   ├── adapters/
│   │   ├── sheets/                     # Google Sheets API
│   │   │   ├── client.go
│   │   │   └── parser.go               # Parse sheet row to struct
│   │   │
│   │   ├── queue/
│   │   │   └── bullmq_publisher.go
│   │   │
│   │   └── repositories/
│   │       ├── call_repository.go
│   │       └── sync_state_repository.go # Track last sync timestamp
│   │
│   ├── core/
│   │   ├── domain/
│   │   │   ├── sheet_call_entry.go
│   │   │   └── sync_state.go
│   │   │
│   │   ├── ports/
│   │   │   ├── sheets_client.go
│   │   │   └── sync_repository.go
│   │   │
│   │   └── usecases/
│   │       ├── sync_calls.go
│   │       └── detect_new_entries.go
│   │
│   └── infrastructure/
│       ├── config/
│       ├── database/
│       ├── redis/
│       ├── cron/
│       │   └── scheduler.go            # robfig/cron
│       └── cache/
│           └── redis_cache.go
│
├── pkg/
│   └── parsers/
│       └── date_parser.go              # "12.09.2025" → time.Time
│
├── Dockerfile
├── go.mod
└── README.md
```

---

## Service 4: Script Management (Golang + Python)

```
services/script-service/
├── cmd/
│   └── script/
│       └── main.go
│
├── internal/
│   ├── adapters/
│   │   ├── http/
│   │   │   ├── handlers/
│   │   │   │   ├── upload.go
│   │   │   │   ├── list.go
│   │   │   │   ├── get.go
│   │   │   │   └── delete.go
│   │   │   └── routes.go
│   │   │
│   │   ├── storage/
│   │   │   └── minio_client.go         # Upload to MinIO
│   │   │
│   │   ├── parser/
│   │   │   └── document_parser.go      # Calls Python subprocess
│   │   │
│   │   └── repositories/
│   │       └── script_repository.go
│   │
│   ├── core/
│   │   ├── domain/
│   │   │   └── script.go
│   │   │
│   │   ├── ports/
│   │   │   ├── storage_service.go
│   │   │   ├── parser_service.go
│   │   │   └── script_repository.go
│   │   │
│   │   └── usecases/
│   │       ├── upload_script.go
│   │       ├── parse_script.go
│   │       └── retrieve_script.go
│   │
│   └── infrastructure/
│       ├── config/
│       ├── database/
│       └── minio/
│
├── pkg/
│   └── dto/
│       └── script_dto.go
│
├── scripts/                            # Python parsers
│   ├── requirements.txt
│   ├── parse_docx.py
│   └── parse_pdf.py
│
├── Dockerfile
├── go.mod
└── README.md
```

**Python Parser Example (`scripts/parse_docx.py`):**

```python
#!/usr/bin/env python3
import sys
from docx import Document

def extract_text(file_path):
    doc = Document(file_path)
    text = "\n".join([para.text for para in doc.paragraphs if para.text])
    return text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: parse_docx.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    print(extract_text(file_path))
```

---

## Service 5: STT Service (Python)

```
services/stt-service/
├── main.py                             # FastAPI entry point
│
├── src/
│   ├── adapters/                       # Interface Adapters
│   │   ├── queue/
│   │   │   └── bullmq_consumer.py      # Consume audio_processing jobs
│   │   │
│   │   ├── storage/
│   │   │   ├── minio_client.py         # Download audio
│   │   │   └── postgres_repo.py        # Save transcripts
│   │   │
│   │   ├── events/
│   │   │   └── redis_publisher.py      # Publish transcript_ready event
│   │   │
│   │   └── api/
│   │       ├── routes.py               # gRPC server
│   │       └── grpc_server.py
│   │
│   ├── core/                           # Business Logic
│   │   ├── domain/
│   │   │   ├── transcript.py
│   │   │   ├── audio.py
│   │   │   └── job.py
│   │   │
│   │   ├── ports/                      # Interfaces
│   │   │   ├── stt_provider.py
│   │   │   ├── diarization_provider.py
│   │   │   ├── storage_service.py
│   │   │   └── event_publisher.py
│   │   │
│   │   └── usecases/
│   │       ├── process_audio.py        # Main orchestrator
│   │       └── retry_logic.py
│   │
│   ├── infrastructure/                 # Frameworks & Drivers
│   │   ├── stt/
│   │   │   ├── whisperx_local.py       # WhisperX implementation
│   │   │   ├── openai_api.py           # OpenAI Whisper API
│   │   │   └── gemini_api.py           # Google Gemini STT
│   │   │
│   │   ├── diarization/
│   │   │   └── pyannote.py             # Pyannote audio
│   │   │
│   │   ├── audio/
│   │   │   ├── converter.py            # FFmpeg wrapper (16kHz WAV)
│   │   │   └── downloader.py
│   │   │
│   │   └── database/
│   │       └── postgres_client.py
│   │
│   └── config/
│       └── settings.py                 # Pydantic settings
│
├── tests/
│   ├── test_whisperx.py
│   └── test_diarization.py
│
├── requirements.txt
├── Dockerfile
└── README.md
```

**Key Files:**

**`main.py`:**

```python
from fastapi import FastAPI
from src.adapters.queue.bullmq_consumer import start_consumer
from src.adapters.api.grpc_server import start_grpc_server
import asyncio

app = FastAPI(title="STT Service")

@app.on_event("startup")
async def startup():
    # Start BullMQ consumer in background
    asyncio.create_task(start_consumer())
    # Start gRPC server
    asyncio.create_task(start_grpc_server())

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

**`src/core/usecases/process_audio.py`:**

```python
from src.core.ports.stt_provider import STTProvider
from src.core.ports.diarization_provider import DiarizationProvider
from src.infrastructure.audio.downloader import download_audio
from src.infrastructure.audio.converter import convert_to_wav

class ProcessAudioUseCase:
    def __init__(self, stt: STTProvider, diarization: DiarizationProvider):
        self.stt = stt
        self.diarization = diarization

    async def execute(self, audio_url: str, call_id: str, company_settings: dict):
        # 1. Download
        audio_path = await download_audio(audio_url, f"/tmp/{call_id}.mp3")

        # 2. Convert
        wav_path = convert_to_wav(audio_path)

        # 3. Diarize
        diarization_result = self.diarization.diarize(wav_path)

        # 4. Transcribe (choose provider based on company_settings)
        transcript = self.stt.transcribe(wav_path, diarization_result)

        # 5. Cleanup
        os.remove(audio_path)
        os.remove(wav_path)

        return transcript
```

---

## Service 6: AI Analytics (Python)

```
services/ai-analytics/
├── main.py
│
├── src/
│   ├── adapters/
│   │   ├── events/
│   │   │   └── redis_consumer.py       # Consume transcript_ready events
│   │   │
│   │   ├── storage/
│   │   │   ├── minio_client.py         # Fetch scripts
│   │   │   └── postgres_repo.py        # Save analysis reports
│   │   │
│   │   ├── crm/
│   │   │   └── amocrm_client.py        # Write back to CRM
│   │   │
│   │   └── api/
│   │       └── grpc_server.py
│   │
│   ├── core/
│   │   ├── domain/
│   │   │   ├── analysis_report.py
│   │   │   ├── metrics.py
│   │   │   └── call_data.py
│   │   │
│   │   ├── ports/
│   │   │   ├── llm_provider.py
│   │   │   └── analytics_repository.py
│   │   │
│   │   └── usecases/
│   │       ├── analyze_call.py         # Main orchestrator
│   │       ├── calculate_kpi.py
│   │       └── generate_recommendations.py
│   │
│   ├── infrastructure/
│   │   ├── llm/
│   │   │   ├── openai_client.py
│   │   │   └── gemini_client.py
│   │   │
│   │   ├── prompts/
│   │   │   ├── system_prompt.py
│   │   │   ├── scoring_rubric.py
│   │   │   └── examples.py             # Few-shot examples
│   │   │
│   │   └── database/
│   │       └── postgres_client.py
│   │
│   └── config/
│       └── settings.py
│
├── tests/
│   ├── test_kpi_calculation.py
│   └── test_llm_prompts.py
│
├── requirements.txt
├── Dockerfile
└── README.md
```

**Key Files:**

**`src/core/usecases/analyze_call.py`:**

```python
from src.core.ports.llm_provider import LLMProvider
from src.core.usecases.calculate_kpi import calculate_kpi

class AnalyzeCallUseCase:
    def __init__(self, llm: LLMProvider, repo):
        self.llm = llm
        self.repo = repo

    async def execute(self, call_id: str):
        # 1. Fetch transcript
        transcript = await self.repo.get_transcript(call_id)

        # 2. Fetch company script
        script = await self.repo.get_active_script(transcript.company_id)

        # 3. Run LLM analysis
        analysis = await self.llm.analyze(transcript.text, script.parsed_text)

        # 4. Calculate KPI
        kpi = calculate_kpi(
            analysis['quality_score'],
            analysis['script_match'],
            analysis['errors_free'],
            transcript.duration
        )

        # 5. Save report
        report = {
            'call_id': call_id,
            **analysis,
            'kpi': kpi
        }
        await self.repo.save_analysis(report)

        # 6. Write back to CRM (optional)
        await self.crm_client.add_note(call_id, analysis['brief'])

        return report
```

**`src/core/usecases/calculate_kpi.py`:**

```python
def calculate_kpi(quality: int, script_match: int, errors_free: int, duration: int) -> float:
    """
    KPI = (Quality * 0.4 + ScriptMatch * 0.4 + ErrorsFree * 0.2) * (Duration / 60)

    Args:
        quality: 0-100
        script_match: 0-100
        errors_free: 0-100
        duration: seconds

    Returns:
        KPI score (float)
    """
    overall = (quality * 0.4 + script_match * 0.4 + errors_free * 0.2)
    duration_minutes = duration / 60
    return round(overall * duration_minutes, 1)
```

**`src/infrastructure/prompts/system_prompt.py`:**

```python
SYSTEM_PROMPT = """
You are an expert sales quality analyst for a B2B SaaS company.

Your task is to analyze sales call transcripts against a predefined sales script.

# Output Format (JSON):
{
  "quality_score": <0-100>,
  "script_match": <0-100>,
  "errors_free": <0-100>,
  "overall_rating": <weighted average>,
  "recommendation": "<3 sentences of actionable feedback>",
  "brief": "<3 sentence summary of the call>",
  "next_best_action": "<concrete next step for the rep>"
}

# Scoring Rubric:

**Quality Score (0-100):**
- Tone: Professional, friendly, empathetic
- Clarity: Clear articulation, no mumbling
- Pace: Not too fast, not too slow
- Active listening: Acknowledges client responses

**Script Match (0-100):**
- Follows phases (Intro, Qualification, Presentation, Close)
- Uses required keywords
- Avoids forbidden keywords
- Adapts script to client needs

**Errors Free (0-100):**
- No rude language
- No false claims
- No grammar errors
- No long pauses (>10s)

# Important Rules:
- Be objective and fair
- Focus on actionable feedback
- Use specific examples from the transcript
- Write in Russian if transcript is in Russian
"""

def get_user_prompt(transcript: str, script: str) -> str:
    return f"""
# TRANSCRIPT:
{transcript}

# SALES SCRIPT:
{script}

Analyze the call and provide the JSON output.
"""
```

---

## Shared Configurations

### `docker-compose.yml`

```yaml
version: "3.8"

services:
  # ============ Infrastructure ============
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: salesai
      POSTGRES_USER: salesai_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - salesai-network

  redis:
    image: redis:7.2-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - salesai-network

  minio:
    image: minio/minio:RELEASE.2024-01-01T16-36-33Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - salesai-network

  # ============ Golang Services ============
  main-api:
    build:
      context: ./services/main-api
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
      - minio
    networks:
      - salesai-network

  webhook-service:
    build:
      context: ./services/webhook-service
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    ports:
      - "8081:8081"
    depends_on:
      - postgres
      - redis
    networks:
      - salesai-network

  sheets-sync:
    build:
      context: ./services/sheets-sync
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      GOOGLE_SHEETS_CREDS: /secrets/google-sheets.json
      SYNC_INTERVAL: "*/5 * * * *" # Every 5 minutes
    volumes:
      - ./secrets:/secrets:ro
    depends_on:
      - postgres
      - redis
    networks:
      - salesai-network

  script-service:
    build:
      context: ./services/script-service
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
    ports:
      - "8083:8083"
    depends_on:
      - postgres
      - minio
    networks:
      - salesai-network

  # ============ Python Services ============
  stt-service:
    build:
      context: ./services/stt-service
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GOOGLE_APPLICATION_CREDENTIALS: /secrets/google-cloud.json
    volumes:
      - ./secrets:/secrets:ro
      - /tmp/audio:/tmp/audio
    ports:
      - "5001:5001"
    depends_on:
      - postgres
      - redis
      - minio
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: "2"
    networks:
      - salesai-network

  ai-analytics:
    build:
      context: ./services/ai-analytics
      dockerfile: Dockerfile
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    ports:
      - "5002:5002"
    depends_on:
      - postgres
      - redis
      - minio
    networks:
      - salesai-network

  # ============ API Gateway ============
  nginx:
    image: nginx:1.25-alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - main-api
      - webhook-service
    networks:
      - salesai-network

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  salesai-network:
    driver: bridge
```

### `.env.example`

```env
# Database
POSTGRES_PASSWORD=your_strong_password_here

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123

# JWT
JWT_SECRET=your_jwt_secret_key_here

# AI APIs
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Google Sheets (if using)
GOOGLE_SHEETS_ID=your_sheet_id_here
```

### `Makefile`

```makefile
.PHONY: help up down logs migrate test

help:
	@echo "Available commands:"
	@echo "  make up       - Start all services"
	@echo "  make down     - Stop all services"
	@echo "  make logs     - View logs"
	@echo "  make migrate  - Run database migrations"
	@echo "  make test     - Run tests"

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	cd services/main-api && go run cmd/migrate/main.go

test:
	cd services/main-api && go test ./...
	cd services/stt-service && pytest
	cd services/ai-analytics && pytest
```

---

## Database Initialization Script

### `scripts/init-db.sql`

```sql
-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS scripts_schema;
CREATE SCHEMA IF NOT EXISTS integrations_schema;
CREATE SCHEMA IF NOT EXISTS calls_schema;
CREATE SCHEMA IF NOT EXISTS logs_schema;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- (Full table definitions from ARCHITECTURE.md)
-- ... (truncated for brevity, copy from Section 4.2)
```

---

## gRPC Proto Definitions

### `proto/stt_service.proto`

```protobuf
syntax = "proto3";

package stt;

option go_package = "github.com/salesai/proto/stt";

service STTService {
  rpc GetTranscript(TranscriptRequest) returns (TranscriptResponse);
  rpc GetProcessingStatus(StatusRequest) returns (StatusResponse);
}

message TranscriptRequest {
  string call_id = 1;
}

message TranscriptResponse {
  string call_id = 1;
  string transcript_json = 2;
  string stt_provider = 3;
  int32 processing_time_seconds = 4;
  string status = 5;
}

message StatusRequest {
  string call_id = 1;
}

message StatusResponse {
  string call_id = 1;
  string status = 2; // processing, completed, error
  string error_message = 3;
}
```

### `proto/generate.sh`

```bash
#!/bin/bash

# Generate Go code
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    stt_service.proto analytics_service.proto

# Generate Python code
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. \
    stt_service.proto analytics_service.proto

echo "gRPC code generated successfully!"
```

---

## Clean Architecture Principles

### Dependency Rule Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                    FRAMEWORKS & DRIVERS                      │
│  (Fiber, FastAPI, PostgreSQL, Redis, gRPC)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           INTERFACE ADAPTERS                        │    │
│  │  (HTTP Handlers, Repositories, gRPC Clients)       │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────┐     │    │
│  │  │    APPLICATION BUSINESS RULES             │     │    │
│  │  │       (Use Cases)                         │     │    │
│  │  │                                           │     │    │
│  │  │  ┌────────────────────────────────┐      │     │    │
│  │  │  │  ENTERPRISE BUSINESS RULES      │      │     │    │
│  │  │  │      (Entities/Domain)          │      │     │    │
│  │  │  └────────────────────────────────┘      │     │    │
│  │  └──────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

Dependencies point INWARD only!
```

### Example: User Registration Flow

```
1. HTTP Request arrives at:
   internal/adapters/http/handlers/auth_handler.go

2. Handler calls Use Case:
   internal/core/usecases/auth/register.go

3. Use Case uses Domain Entity:
   internal/core/domain/user.go

4. Use Case calls Repository Interface (Port):
   internal/core/ports/user_repository.go

5. Repository Implementation (Adapter):
   internal/adapters/repositories/user_repository.go
   → Actual PostgreSQL query

Dependencies: Handler → UseCase → Domain ← Repository
```

---

## Next Steps

1. ✅ Architecture Approved
2. ✅ Folder Structure Defined
3. **TODO**: Implement each service incrementally
4. **TODO**: Write integration tests
5. **TODO**: Deploy to staging environment

---

**Generated by:** Architecture Team  
**Date:** February 8, 2026  
**Version:** 1.0
