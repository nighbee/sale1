# Sipuni Listener Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The Sipuni Listener Service is responsible for ingesting call events from the Sipuni telephony platform via WebSocket connection. It acts as a bridge between Sipuni's call events and the SalesAI platform, creating call records and initiating the audio processing pipeline.

### 1.1 Purpose

- **WebSocket Connection**: Maintain persistent connection to Sipuni WebSocket API
- **Event Ingestion**: Receive and parse call events (ringing, answered, completed)
- **Call Recording**: Extract call metadata and recording URLs
- **Job Enqueueing**: Create call records in PostgreSQL and enqueue audio processing jobs to BullMQ
- **Metrics**: Expose Prometheus metrics for monitoring

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Go | 1.22 |
| Framework | Fiber | 2.52 |
| Database | PostgreSQL | 16 |
| Queue | BullMQ (Redis) | 7.2 |
| WebSocket | gorilla/websocket | - |
| Monitoring | Prometheus | 2.45.0 |
| Logging | Uber Zap | - |

### 1.3 Service Location

- **Port**: 8081
- **Protocol**: WebSocket (client) + HTTP (metrics)
- **WebSocket URL**: `wss://wss.sipuni.com/api`

---

## 2. Architecture

The Sipuni Listener follows **Clean Architecture** principles:

```
services/sipuni-listener/
├── cmd/listener/
│   └── main.go                    # Entry point, WebSocket loop
├── internal/
│   ├── adapters/
│   │   ├── http/                  # Metrics HTTP server
│   │   ├── queue/                # BullMQ publisher
│   │   └── repositories/         # PostgreSQL call repository
│   ├── core/
│   │   ├── domain/               # Call entity definitions
│   │   └── usecases/             # Event handling logic
│   └── infrastructure/
│       └── logger/                # Zap logger configuration
├── go.mod
└── go.sum
```

### 2.1 Component Responsibilities

#### Main (cmd/listener/main.go)
- Initializes database connection
- Sets up Redis publisher for BullMQ
- Establishes WebSocket connection to Sipuni
- Handles reconnection with exponential backoff
- Runs keepalive ping/pong
- Processes incoming events

#### Adapters
- **HTTP**: Prometheus metrics endpoint
- **Queue**: BullMQ job publisher
- **Repositories**: PostgreSQL CRUD operations

#### Core
- **Domain**: Call entity with status, duration, metadata
- **Usecases**: Event parsing and business logic

---

## 3. Communication Patterns

### 3.1 WebSocket Connection (Sipuni)

```
Sipuni Listener ──WebSocket──→ Sipuni API (wss://wss.sipuni.com/api)
```

**Connection Flow:**
1. Connect to Sipuni WebSocket endpoint
2. Send authentication message with API key
3. Receive auth confirmation
4. Listen for call events
5. Send keepalive every 30 seconds
6. Reconnect on disconnect with exponential backoff

### 3.2 Database

```
Sipuni Listener ──PostgreSQL──→ Create call records
```

### 3.3 Message Queue

```
Sipuni Listener ──BullMQ──→ Redis Queue (audio_processing)
```

### 3.4 Complete Data Flow

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Sipuni        │──────────────────│  Sipuni         │
│   Telephony     │                  │  Listener       │
└─────────────────┘                  └────────┬────────┘
                                               │
                                               │ Call Event
                                               ▼
                                       ┌─────────────────┐
                                       │  PostgreSQL     │
                                       │  (Create Call)  │
                                       └────────┬────────┘
                                                │
                                                │ Enqueue Job
                                                ▼
                                        ┌─────────────────┐
                                        │  BullMQ/Redis   │
                                        │  (audio_processing)
                                        └─────────────────┘
```

---

## 4. Event Processing

### 4.1 Incoming Event Format (Sipuni)

The service receives events in the following format:

```json
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

### 4.2 Event Fields

| Field | Type | Description |
|-------|------|-------------|
| `call_id` | string | External Sipuni call ID |
| `event` | string | Event type (5 = completed) |
| `dst_num` | string | Destination phone number |
| `src_num` | string | Source phone number |
| `timestamp` | int | Event timestamp (Unix) |
| `user_id` | string | Manager/agent ID |
| `status` | string | Call status |
| `call_start_timestamp` | int | Call start timestamp (Unix) |
| `call_record_link` | string | URL to call recording |

### 4.3 Processing Logic

1. **Parse Event**: Extract JSON from WebSocket message
2. **Validate**: Check for required fields
3. **Filter**: Only process calls with recording links
4. **Generate UUID**: Create unique call ID
5. **Calculate Duration**: `end_time - start_time`
6. **Determine Client Phone**: Select longer phone number
7. **Create Record**: Insert call into PostgreSQL
8. **Enqueue Job**: Push audio processing job to BullMQ

---

## 5. BullMQ Job Format

When a call with a recording is received, the service enqueues:

```
json
{
  "job_type": "audio_processing",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "audio_url": "https://files.sipuni.com/.../record.mp3",
  "manager_id": "manager-123",
  "retry_count": 0,
  "max_retries": 3
}
```

---

## 6. API Endpoints

### 6.1 Metrics Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/metrics` | Prometheus metrics |

### 6.2 Metrics Exposed

- `sipuni_listener_requests_total` - Total events processed
- `sipuni_listener_request_duration_seconds` - Processing latency
- Custom Fiber metrics (requests, response time)

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP metrics port | 8081 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | redis://redis:6379 |
| `SIPUNI_API_KEY` | Sipuni API authentication key | - |
| `COMPANY_ID` | Company ID for created calls | 550e8400-e29b-41d4-a716-446655440000 |

### 7.2 Docker Configuration

```
yaml
sipuni-listener:
  build: ./services/sipuni-listener
  ports:
    - "8081:8081"
  environment:
    DATABASE_URL: "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    REDIS_URL: "redis://redis:6379"
    SIPUNI_API_KEY: ${SIPUNI_API_KEY}
  depends_on:
    - postgres
    - redis
```

---

## 8. Reconnection Strategy

The service implements a robust reconnection strategy:

1. **Initial Connection**: Connect to WebSocket
2. **On Disconnect**: Wait 2 seconds (base backoff)
3. **Retry**: Exponential backoff (2x multiplier)
4. **Max Backoff**: Cap at 60 seconds
5. **Max Retries**: Unlimited (continuous operation)

### 8.1 Backoff Schedule

```
Attempt 1: 2s
Attempt 2: 4s
Attempt 3: 8s
Attempt 4: 16s
Attempt 5: 32s
Attempt 6: 60s (capped)
...
```

---

## 9. Database Schema

### 9.1 Calls Table

```
sql
CREATE TABLE calls (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    manager_id VARCHAR(255),
    manager_name VARCHAR(255),
    client_phone VARCHAR(50),
    duration INT,
    call_link TEXT,
    call_date TIMESTAMP,
    call_time TIMESTAMP,
    status VARCHAR(50),
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Error Handling

### 10.1 Connection Errors

- **Dial Error**: Log warning, initiate reconnection
- **Auth Failure**: Log error with status code, reconnect
- **Read Error**: Log warning, initiate reconnection

### 10.2 Processing Errors

- **Parse Error**: Log error, skip message
- **Database Error**: Log error, skip processing
- **Queue Error**: Log error, call is saved but job not enqueued

---

## 11. Logging

Structured JSON logging using Uber Zap:

```
json
{
  "level": "info",
  "ts": "2026-02-01T12:00:00.000Z",
  "caller": "main.go:123",
  "msg": "Connected to Sipuni WebSocket server"
}
```

### 11.1 Logged Events

- Connection attempts
- Authentication success/failure
- Received call events
- Call record creation
- Job enqueueing
- Errors and warnings

---

## 12. Dependencies

### 12.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Store call records |
| BullMQ/Redis | Direct | Queue audio processing jobs |

### 12.2 External Services

| Service | Integration | Purpose |
|---------|------------|---------|
| Sipuni | WebSocket | Call event ingestion |
| Sipuni | HTTPS | Audio file retrieval |

---

## 13. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [Main API Documentation](./main-api.md)
- [STT Service Documentation](./stt-service.md)
- [Deployment Guide](../deployment.md)
