# Sheets Sync Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The Sheets Sync Service is responsible for synchronizing data between the SalesAI platform and Google Sheets. It enables teams to export their call data and analytics to Google Sheets for external reporting and analysis.

### 1.1 Purpose

- **Data Export**: Export call data and analytics to Google Sheets
- **Scheduled Sync**: Periodic synchronization (cron-like)
- **Manual Sync**: Trigger sync manually via API
- **Custom Reports**: Create custom sheet templates
- **Team Access**: Share sheets with team members

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.11 |
| Framework | FastAPI | 0.109 |
| API | Google Sheets API | v4 |
| Database | PostgreSQL | 16 |
| Scheduling | Built-in (time.sleep) | - |
| Logging | Python json-logger | 2.0.7 |

### 1.3 Service Location

- **Port**: 8085 (API mode) / No port (scheduler mode)
- **Protocol**: HTTP REST
- **Base Path**: `/`

---

## 2. Architecture

The Sheets Sync Service follows a modular Python service architecture:

```
services/sheets-sync/
├── main.py                        # Entry point (scheduler/api modes)
├── src/
│   ├── config.py                  # Configuration
│   ├── db.py                      # PostgreSQL client
│   ├── logging_setup.py           # Logging configuration
│   ├── pipeline.py                # Sync pipeline
│   ├── queue_client.py            # Redis queue client
│   └── sheets_client.py           # Google Sheets client
├── gcp-sa.json                   # Google service account credentials
├── requirements.txt               # Python dependencies
├── Dockerfile
└── main.py                        # Entry point (scheduler or api mode)
```

### 2.1 Component Responsibilities

#### Main (main.py)
- Initializes logging
- Supports two modes: `scheduler` (default) and `api`
- Scheduler mode: Runs sync on a cron loop with configurable interval
- API mode: Exposes FastAPI HTTP server with sync endpoints

#### Src
- **config.py**: Configuration and environment variables
- **db.py**: PostgreSQL client for fetching data
- **logging_setup.py**: JSON structured logging setup
- **pipeline.py**: Main sync logic
- **queue_client.py**: Redis queue client (if needed)
- **sheets_client.py**: Google Sheets API client

---

## 3. Service Modes

### 3.1 Scheduler Mode (Default)

Runs the sync pipeline on a configurable interval:

```
RUN_MODE=scheduler  # Default
```

**Behavior:**
- Runs one immediate sync cycle on startup
- Sleeps for `SYNC_INTERVAL` seconds between cycles
- Logs all sync operations

### 3.2 API Mode

Exposes a FastAPI HTTP server:

```
RUN_MODE=api
```

**Behavior:**
- Runs one immediate sync cycle on startup
- Exposes HTTP endpoints for manual sync
- Can trigger background sync via API

---

## 4. Communication Patterns

### 4.1 Database Access

```
Sheets Sync ──Query──→ PostgreSQL
```

### 4.2 Google Sheets API

```
Sheets Sync ──API──→ Google Sheets
```

### 4.3 Data Flow

```
┌─────────────────────┐
│  PostgreSQL        │
│  (Query Data)      │
└────────┬────────────┘
         │ Fetch data
         ▼
┌─────────────────────┐
│  Sheets Sync        │
│  (Transform)       │
└────────┬────────────┘
         │ Export
         ▼
┌─────────────────────┐
│  Google Sheets      │
│  (Write Data)      │
└─────────────────────┘
```

---

## 5. API Endpoints

### 5.1 API Mode Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/sync` | Trigger async sync |
| POST | `/sync/blocking` | Trigger blocking sync |

#### GET /health

**Response:**
```
json
{
  "status": "ok",
  "service": "sheets-sync"
}
```

#### POST /sync

Triggers a background sync task and returns immediately.

**Response:**
```
json
{
  "status": "accepted",
  "message": "Sync cycle started"
}
```

#### POST /sync/blocking

Triggers a blocking sync and waits for completion.

**Response (Success):**
```
json
{
  "status": "completed"
}
```

**Response (Error):**
```
json
{
  "status": "error",
  "message": "Error description"
}
```

---

## 6. Features

### 6.1 Data Export

- Call records with transcripts
- Analytics reports
- Team performance data
- Leaderboard rankings

### 6.2 Scheduling

- Configurable sync intervals via `SYNC_INTERVAL` env var
- Hourly, daily, weekly options based on interval
- Manual trigger support via API

### 6.3 Sheet Templates

- Custom column mappings
- Multiple sheet support
- Header customization

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `RUN_MODE` | Service mode: scheduler or api | scheduler |
| `PORT` | HTTP server port (api mode) | 8085 |
| `SYNC_INTERVAL` | Sync interval in seconds | 3600 |
| `GOOGLE_CREDENTIALS` | Google API credentials path | gcp-sa.json |
| `SPREADSHEET_ID` | Target Google Sheet ID | - |
| `LOG_LEVEL` | Logging level | INFO |

### 7.2 Google Authentication

Service account or OAuth2:
- Service account recommended for server-to-server
- OAuth2 for user-delegated access

### 7.3 Docker Configuration

```
yaml
sheets-sync:
  build: ./services/sheets-sync
  environment:
    DATABASE_URL: "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    RUN_MODE: "scheduler"
    SYNC_INTERVAL: "3600"
    GOOGLE_CREDENTIALS: "/app/gcp-sa.json"
    SPREADSHEET_ID: "${SPREADSHEET_ID}"
    LOG_LEVEL: "INFO"
  volumes:
    - ./services/sheets-sync/gcp-sa.json:/app/gcp-sa.json:ro
  depends_on:
    - postgres
```

---

## 8. Integration Points

### 8.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Query call and analytics data |

### 8.2 External Services

| Service | Integration | Purpose |
|---------|------------|---------|
| Google Sheets | API v4 | Export data |

---

## 9. Error Handling

### 9.1 Sync Errors

- **Database Error**: Log error, skip sync cycle
- **Google API Error**: Log error, retry on next cycle
- **Network Error**: Log error, continue to next cycle

### 9.2 Logging

Structured JSON logging:

```
json
{
  "level": "info",
  "ts": "2026-02-01T12:00:00.000Z",
  "name": "sheets-sync",
  "msg": "Sync cycle completed",
  "status": "success"
}
```

---

## 10. Dependencies

### 10.1 Python Packages

```
fastapi==0.109.0
uvicorn==0.27.0
psycopg2-binary==2.9.9
google-api-python-client==2.122.0
python-dotenv==1.0.0
```

---

## 11. Future Enhancements

- Bi-directional sync (import from Sheets)
- Real-time sync via Webhooks
- Custom report builder
- Team-specific sheets

---

## 12. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [Main API Documentation](./main-api.md)
- [Deployment Guide](../deployment.md)
