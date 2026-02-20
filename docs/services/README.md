# SalesAI - Service Documentation Index

Welcome to the SalesAI platform service documentation. This directory contains comprehensive documentation for each service in the system.

---

## Table of Contents

| # | Service | Description | Status |
|---|---------|-------------|--------|
| 1 | [Main API](./main-api.md) | Central API, Auth, CRUD, WebSocket | ✅ Production |
| 2 | [Sipuni Listener](./sipuni-listener.md) | WebSocket telephony integration | ✅ Production |
| 3 | [Script Service](./script-service.md) | Script upload and management | ✅ Production |
| 4 | [STT Service](./stt-service.md) | Speech-to-text processing | ✅ Production |
| 5 | [AI Analytics](./ai-analytics.md) | LLM-based call analysis | ✅ Production |
| 6 | [Frontend](./frontend.md) | React web interface | ✅ Production |
| 7 | [Sheets Sync](./sheets-sync.md) | Google Sheets integration | 🔄 Planned |

---

## Quick Reference

### Service Communication Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client (Browser)                                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTP/WebSocket
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Nginx (Port 80)                                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Main API      │    │ Script Service  │    │Sipuni Listener │
│   (Go/Fiber)   │    │   (Go/Fiber)    │    │   (Go/Fiber)   │
│   Port: 8080    │    │   Port: 8083    │    │   Port: 8081   │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         │◄──────────────────────┴───────────────────────┘
         │
         │                   ┌──────────────────────────────┐
         │                   │                              │
         ▼                   ▼                              ▼
┌─────────────────┐   ┌─────────────┐              ┌─────────────┐
│   PostgreSQL    │   │   MinIO     │              │    Redis    │
│   (Port 5432)   │   │  (Port 9000)│              │  (Port 6379)│
└─────────────────┘   └─────────────┘              └──────┬──────┘
                                                         │
                                    ┌────────────────────┼────────────────────┐
                                    │                    │                    │
                                    ▼                    ▼                    ▼
                           ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                           │   STT Service   │  │ AI Analytics   │  │   Main API     │
                           │   (Python)      │  │   (Python)     │  │  (Consumer)    │
                           │   Port: 5001    │  │   Port: 5002   │  │                 │
                           └────────┬────────┘  └────────┬────────┘  └─────────────────┘
                                    │                   │
                                    │                   │
                                    ▼                   ▼
                           ┌─────────────────┐  ┌─────────────────┐
                           │  Transcript     │  │  Analysis       │
                           │  PostgreSQL     │  │  PostgreSQL     │
                           └─────────────────┘  └─────────────────┘
```

### Technology Stack Summary

| Service | Language | Framework | Port |
|---------|----------|-----------|------|
| Main API | Go 1.22 | Fiber 2.52 | 8080 |
| Sipuni Listener | Go 1.22 | Fiber 2.52 | 8081 |
| Script Service | Go 1.22 | Fiber 2.52 | 8083 |
| STT Service | Python 3.11 | FastAPI 0.109 | 5001 |
| AI Analytics | Python 3.11 | FastAPI 0.109 | 5002 |
| Frontend | TypeScript | React 18 | 80 |

---

## Data Flow Summary

### Call Processing Pipeline

```
1. Sipuni (Telephony)
      │
      │ WebSocket
      ▼
2. Sipuni Listener (Go)
      │
      │ Create call + Enqueue job
      ▼
3. PostgreSQL + BullMQ
      │
      │ Process audio job
      ▼
4. STT Service (Python)
      │
      │ Save transcript + Publish event
      ▼
5. PostgreSQL + Redis Stream
      │
      │ Consume transcript_ready
      ▼
6. AI Analytics (Python)
      │
      │ Save analysis report
      ▼
7. PostgreSQL
      │
      │ Notify via Redis Pub/Sub
      ▼
8. Main API WebSocket Hub
      │
      │ Broadcast to client
      ▼
9. Frontend (Real-time update)
```

---

## Documentation Structure

Each service document contains:

1. **Service Overview** - Purpose, technology stack, location
2. **Architecture** - Clean Architecture structure
3. **API Endpoints** - Available endpoints (for HTTP services)
4. **Communication Patterns** - How it connects to other services
5. **Data Flow** - Processing pipeline
6. **Configuration** - Environment variables
7. **Database Schema** - Relevant tables
8. **Monitoring** - Metrics and logging
9. **Dependencies** - Internal and external services
10. **Related Documentation** - Cross-references

---

## Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [API Contract](../api_contract.md)
- [Database Schema](../database_initial_migration.md)
- [Deployment Guide](../deployment.md)

---

## Navigation

- **For Developers**: Start with [Main API](./main-api.md) to understand the core
- **For Operations**: Start with [Architecture Overview](../architecture.md)
- **For Integration**: Check the relevant service documentation

---

*Last Updated: February 2026*
