# AI Analytics Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The AI Analytics Service is responsible for analyzing transcribed calls using Large Language Models (LLM). It consumes transcript-ready events from Redis Stream, fetches call transcripts and scripts, performs AI-powered analysis, calculates KPIs, and stores analysis reports in PostgreSQL.

### 1.1 Purpose

- **Event Consumption**: Listen for transcript_ready events from Redis Stream
- **Data Fetching**: Retrieve transcripts and scripts from PostgreSQL
- **LLM Analysis**: Analyze calls using OpenAI GPT-4 or Google Gemini
- **Metric Calculation**: Calculate quality scores, script match, talk time ratios
- **KPI Computation**: Compute composite performance scores
- **CRM Integration**: Optionally push results to AmoCRM

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.11 |
| Framework | FastAPI | 0.109 |
| Database | PostgreSQL | 16 |
| Event Stream | Redis Streams | 7.2 |
| LLM (OpenAI) | GPT-4 API | - |
| LLM (Google) | Gemini 3 Flash Preview | - |
| Monitoring | Prometheus | - |
| Logging | Python logging | - |

### 1.3 Service Location

- **Internal Port**: 5002 (gRPC)
- **Metrics Port**: 8001
- **Protocol**: gRPC Server + Redis Stream Consumer

---

## 2. Architecture

The AI Analytics Service follows **Clean Architecture** principles:

```
services/ai-analytics/
├── main.py                        # Entry point
├── src/
│   ├── adapters/
│   │   ├── events/                # Redis Stream consumer
│   │   ├── storage/               # PostgreSQL clients
│   │   └── crm/                  # AmoCRM client
│   ├── core/
│   │   ├── domain/                # AnalysisReport, Metrics entities
│   │   └── usecases/             # Analysis, KPI calculation
│   ├── infrastructure/
│   │   ├── llm/                  # OpenAI, Gemini clients
│   │   └── prompts/              # System prompts, scoring rubrics
│   └── config/                   # Settings
├── requirements.txt
└── Dockerfile
```

### 2.1 Component Responsibilities

#### Main (main.py)
- Initializes logging
- Starts Prometheus metrics server
- Starts gRPC server
- Initializes Redis Stream consumer

#### Adapters
- **Events**: Consume transcript_ready events from Redis
- **Storage**: PostgreSQL client for transcripts, scripts, reports
- **CRM**: AmoCRM integration (optional)

#### Core
- **Domain**: AnalysisReport entity with metrics
- **Usecases**: Analysis logic and KPI calculation

#### Infrastructure
- **LLM**: Provider-specific implementations (OpenAI, Gemini)
- **Prompts**: System prompts and scoring rubrics

---

## 3. Communication Patterns

### 3.1 Event Consumption

```
Redis Stream (transcript_ready) ──Consume──→ AI Analytics
```

### 3.2 Database Access

```
AI Analytics ──Fetch Transcript──→ PostgreSQL
AI Analytics ──Fetch Script──→ PostgreSQL
AI Analytics ──Save Report──→ PostgreSQL
```

### 3.3 Complete Data Flow

```
┌─────────────────────┐
│  Redis Stream       │
│  (transcript_ready) │
└────────┬────────────┘
         │ Consume Event
         ▼
┌─────────────────────┐
│  AI Analytics       │
└────────┬────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│PostgreSQL│ │MinIO │
│(Transcript)│(Script)│
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────────┐
│  LLM Provider       │
│  (OpenAI/Gemini)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  KPI Calculator     │
│  (Scoring Logic)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  PostgreSQL         │
│  (Save Report)     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Optional: AmoCRM   │
│  (Push Results)    │
└─────────────────────┘
```

---

## 4. Processing Flow

### 4.1 Event Processing Pipeline

1. **Receive Event**: Consume `transcript_ready` from Redis Stream
2. **Fetch Transcript**: Get transcript from PostgreSQL
3. **Fetch Script**: Get associated script from database
4. **Prepare Prompt**: Build system prompt with script context
5. **Call LLM**: Send to OpenAI GPT-4 or Google Gemini
6. **Parse Response**: Extract analysis results
7. **Calculate Metrics**: Compute quality score, script match, etc.
8. **Compute KPI**: Calculate composite score
9. **Save Report**: Store in PostgreSQL
10. **Optional**: Push to AmoCRM

### 4.2 Input Event Format

```
json
{
  "event_type": "transcript_ready",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

### 4.3 Analysis Output Format

```
json
{
  "call_id": "uuid-generated",
  "quality_score": 85,
  "script_match": 0.72,
  "talk_time_ratio": {
    "manager_seconds": 120,
    "client_seconds": 180,
    "manager_percentage": 40,
    "client_percentage": 60
  },
  "errors": [
    {
      "type": "missed_objection",
      "timestamp": 45.5,
      "description": "Client raised pricing concern"
    }
  ],
  "kpi": 78.5,
  "summary": "Good call with successful product demo...",
  "created_at": "2026-02-01T12:00:00Z"
}
```

---

## 5. LLM Providers

### 5.1 OpenAI GPT-4

- **Provider**: OpenAI API
- **Model**: `gpt-4` or `gpt-4-turbo`
- **Configuration**: `OPENAI_API_KEY`
- **Use Case**: Primary analysis provider

### 5.2 Google Gemini 3 Flash Preview

- **Provider**: Google AI
- **Model**: `gemini-3-flash-preview`
- **Configuration**: `GEMINI_API_KEY`
- **Use Case**: Primary analysis provider, offering low latency and high accuracy for Russian language.

---

## 6. Analysis Metrics

### 6.1 Quality Score (0-100)

Overall assessment of call quality based on:
- Professionalism
- Clarity
- Objection handling
- Closing skills

### 6.2 Script Match (0-1.0)

Percentage of script followed:
- Tracks adherence to sales script
- Measures deviations
- Identifies improvisations

### 6.3 Talk Time Ratio

Distribution of talk time:
- Manager vs client speaking time
- Percentage breakdown
- Ideal ratio: 40/60 (manager/client)

### 6.4 Error Count

Number of detected issues:
- Missed objections
- Incorrect information
- Policy violations

### 6.5 KPI (Composite Score)

Weighted composite of all metrics:
```
KPI = (quality_score * 0.4) + (script_match * 100 * 0.3) + (talk_time_score * 0.2) + (error_penalty)
```

---

## 7. gRPC API

The AI Analytics Service exposes a gRPC interface for synchronous requests.

### 7.1 Service Definition

See `proto/analytics_service.proto`:

```
proto
service AnalyticsService {
  rpc AnalyzeCall(AnalyzeCallRequest) returns (AnalyzeCallResponse);
  rpc GetAnalysis(GetAnalysisRequest) returns (GetAnalysisResponse);
}
```

### 7.2 Analyze Call Request

```
proto
message AnalyzeCallRequest {
  string call_id = 1;
  string script_id = 2;
  string provider = 3;  // "openai", "gemini"
}
```

### 7.3 Analyze Call Response

```
proto
message AnalyzeCallResponse {
  string call_id = 1;
  AnalysisReport report = 2;
  bool success = 3;
  string error = 4;
}
```

---

## 8. Configuration

### 8.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | redis://redis:6379 |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GOOGLE_API_KEY` | Google API key | - |
| `GOOGLE_AI_MODEL` | Google model name | - |
| `METRICS_PORT` | Prometheus metrics port | 8001 |

### 8.2 Docker Configuration

```
yaml
ai-analytics:
  build: ./services/ai-analytics
  environment:
    DATABASE_URL: "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    REDIS_URL: "redis://redis:6379"
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    GOOGLE_API_KEY: ${GOOGLE_API_KEY}
    GOOGLE_AI_MODEL: ${GOOGLE_AI_MODEL}
  depends_on:
    - postgres
    - redis
```

---

## 9. Database Schema

### 9.1 Analysis Reports Table

```
sql
CREATE TABLE analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID UNIQUE NOT NULL,
    quality_score INT,
    script_match FLOAT,
    talk_time_ratio JSONB,
    errors JSONB,
    kpi FLOAT,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_reports_call_id ON analysis_reports(call_id);
```

---

## 10. Redis Events

### 10.1 Transcript Ready Event (Consumer)

Consumed from Redis Stream `transcript_ready`:

```
json
{
  "event_type": "transcript_ready",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

---

## 11. CRM Integration (Optional)

### 11.1 AmoCRM

The service can optionally push analysis results to AmoCRM:
- Update contact fields with KPI
- Create tasks for follow-up
- Log call summaries

---

## 12. Error Handling

### 12.1 Processing Errors

- **Transcript Not Found**: Log error, skip analysis
- **Script Not Found**: Analyze without script context
- **LLM API Error**: Retry with exponential backoff
- **Database Error**: Log error, mark as failed

### 12.2 Error Recovery

- Failed analyses can be retried
- Partial results saved when possible

---

## 13. Monitoring

### 13.1 Metrics

Prometheus metrics exposed at `/metrics`:

- `analytics_requests_total` - Total analysis requests
- `analytics_request_duration_seconds` - Analysis latency
- `analytics_requests_failed_total` - Failed analyses

### 13.2 Logging

Structured logging:

```
json
{
  "level": "info",
  "ts": "2026-02-01T12:00:00.000Z",
  "msg": "Analysis completed",
  "call_id": "uuid",
  "quality_score": 85,
  "kpi": 78.5
}
```

---

## 14. Dependencies

### 14.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Store transcripts, scripts, reports |
| Redis Streams | Direct | Consume transcript events |
| STT Service | Publish events | Receives processed transcripts |

### 14.2 External Services

| Service | Integration | Purpose |
|---------|------------|---------|
| OpenAI | API | GPT-4 analysis |
| Google | API | Gemini analysis |
| AmoCRM | REST API | CRM sync (optional) |

---

## 15. Integration with Other Services

### 15.1 STT Service

- Receives `transcript_ready` events
- Fetches transcripts from PostgreSQL

### 15.2 Script Service

- Fetches sales scripts for context

### 15.3 Main API

- Can request analysis via gRPC
- Reads reports for display

---

## 16. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [STT Service Documentation](./stt-service.md)
- [Main API Documentation](./main-api.md)
- [Script Service Documentation](./script-service.md)
- [gRPC Contract](../../proto/analytics_service.proto)
- [Deployment Guide](../deployment.md)
