# Sheets Sync Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Planned

---

## 1. Service Overview

The Sheets Sync Service is responsible for synchronizing data between the SalesAI platform and Google Sheets. It enables teams to export their call data and analytics to Google Sheets for external reporting and analysis.

### 1.1 Purpose

- **Data Export**: Export call data and analytics to Google Sheets
- **Scheduled Sync**: Periodic synchronization (cron-like)
- **Custom Reports**: Create custom sheet templates
- **Team Access**: Share sheets with team members

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Go | 1.24 |
| API | Google Sheets API | v4 |
| Database | PostgreSQL | 16 |
| Scheduling | Cron | - |

---

## 2. Architecture

The Sheets Sync Service follows a simple service architecture:

```
services/sheets-sync/
├── cmd/
│   └── sync/
│       └── main.go              # Entry point
├── internal/
│   ├── adapters/
│   │   ├── sheets/             # Google Sheets client
│   │   └── database/           # PostgreSQL client
│   └── config/                 # Configuration
├── go.mod
└── go.sum
```

---

## 3. Communication Patterns

### 3.1 Database Access

```
Sheets Sync ──Query──→ PostgreSQL
```

### 3.2 Google Sheets API

```
Sheets Sync ──API──→ Google Sheets
```

### 3.3 Data Flow

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

## 4. Features

### 4.1 Data Export

- Call records with transcripts
- Analytics reports
- Team performance data
- Leaderboard rankings

### 4.2 Scheduling

- Configurable sync intervals
- Hourly, daily, weekly options
- Manual trigger support

### 4.3 Sheet Templates

- Custom column mappings
- Multiple sheet support
- Header customization

---

## 5. Configuration

### 5.1 Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CREDENTIALS` | Google API credentials (JSON) |
| `SPREADSHEET_ID` | Target Google Sheet ID |
| `SYNC_INTERVAL` | Sync frequency |

### 5.2 Google Authentication

Service account or OAuth2:
- Service account recommended for server-to-server
- OAuth2 for user-delegated access

---

## 6. Integration Points

### 6.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Query call and analytics data |

### 6.2 External Services

| Service | Integration | Purpose |
|---------|------------|---------|
| Google Sheets | API v4 | Export data |

---

## 7. Future Enhancements

- Bi-directional sync (import from Sheets)
- Real-time sync via Webhooks
- Custom report builder
- Team-specific sheets

---

## 8. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [Main API Documentation](./main-api.md)
- [Deployment Guide](../deployment.md)
