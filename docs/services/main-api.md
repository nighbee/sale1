# Main API Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The Main API Service is the central orchestration layer of the SalesAI platform. It provides the primary RESTful API for all client-facing operations, handles authentication, manages CRUD operations for core entities, and coordinates communication between other services.

### 1.1 Purpose

- **Authentication & Authorization**: JWT-based authentication with role-based access control (RBAC)
- **Core Data Management**: CRUD operations for calls, users, companies, teams, scripts
- **Analytics Aggregation**: Provides analytics endpoints for team performance and leaderboards
- **Real-time Notifications**: WebSocket hub for pushing notifications to clients
- **Service Coordination**: gRPC client for communicating with Python services AI (STT, Analytics)

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Go | 1.22 |
| Framework | Fiber | 2.52 |
| Database | PostgreSQL | 16 |
| Cache/Queue | Redis | 7.2 |
| Object Storage | MinIO | Latest |
| Authentication | JWT | - |
| Monitoring | Prometheus | 2.45.0 |
| Logging | Uber Zap | - |

### 1.3 Service Location

- **Port**: 8080
- **Protocol**: HTTP REST + gRPC Client + WebSocket
- **Base Path**: `/api/v1`

---

## 2. Architecture

The Main API follows **Clean Architecture** principles with clear separation of concerns:

```
services/main-api/
├── cmd/api/
│   └── main.go                    # Application entry point
├── internal/
│   ├── adapters/
│   │   ├── events/               # Redis consumer for real-time notifications
│   │   ├── grpc/                 # gRPC clients for STT and AI Analytics
│   │   ├── http/
│   │   │   ├── handlers/         # HTTP request handlers/controllers
│   │   │   ├── middleware/       # JWT auth, RBAC, logging middleware
│   │   │   ├── routes.go         # Route registration
│   │   │   └── ws/               # WebSocket hub implementation
│   │   └── repositories/        # PostgreSQL repository implementations
│   ├── core/
│   │   ├── domain/               # Domain entities (User, Call, Company, etc.)
│   │   ├── ports/                # Interface definitions
│   │   └── usecases/             # Business logic implementation
│   └── infrastructure/
│       ├── config/               # Configuration loading
│       ├── database/             # PostgreSQL connection, migrations
│       └── security/             # JWT service implementation
├── docs/                         # Swagger documentation
├── go.mod
└── go.sum
```

### 2.1 Layer Responsibilities

#### Adapters Layer
- **HTTP Handlers**: Process incoming HTTP requests, validate input, return responses
- **Middleware**: Cross-cutting concerns (authentication, logging, metrics)
- **Repositories**: Database access implementations
- **gRPC Clients**: Communication with external Python services
- **WebSocket Hub**: Real-time push notifications to clients

#### Core Layer
- **Domain**: Business entities and value objects
- **Ports**: Interface definitions (abstracting infrastructure)
- **Usecases**: Application business logic

#### Infrastructure Layer
- **Config**: Environment-based configuration
- **Database**: PostgreSQL connection pool and migrations
- **Security**: JWT token generation and validation

---

## 3. API Endpoints

### 3.1 Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | User registration | No |
| POST | `/api/v1/auth/login` | User login | No |
| POST | `/api/v1/auth/refresh` | Refresh JWT token | Yes |

### 3.2 Calls

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/calls` | List calls (with filters) | Yes |
| GET | `/api/v1/calls/:id` | Get call details | Yes |
| GET | `/api/v1/calls/:id/transcript` | Get transcript | Yes |
| GET | `/api/v1/calls/:id/analysis` | Get analysis report | Yes |

**Query Parameters for GET /api/v1/calls:**
- `manager_id` - Filter by manager
- `date_start` - Filter by start date
- `date_end` - Filter by end date
- `status` - Filter by status

### 3.3 Analytics

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/analytics/team-performance` | Team performance metrics | Yes |
| GET | `/api/v1/analytics/leaderboard` | Leaderboard data | Yes |

### 3.4 Companies

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/companies/:id/settings` | Get company settings | Yes |
| PUT | `/api/v1/companies/:id/settings` | Update settings | Yes |

### 3.5 Teams

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/teams` | List teams | Yes |
| POST | `/api/v1/teams` | Create team | Yes |
| GET | `/api/v1/teams/:id` | Get team details | Yes |
| PUT | `/api/v1/teams/:id` | Update team | Yes |
| DELETE | `/api/v1/teams/:id` | Delete team | Yes |

### 3.6 Scripts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/scripts` | List scripts | Yes |
| POST | `/api/v1/scripts` | Upload script | Yes |
| DELETE | `/api/v1/scripts/:id` | Delete script | Yes |

### 3.7 Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/users` | List users | Yes |
| GET | `/api/v1/users/:id` | Get user details | Yes |
| PUT | `/api/v1/users/:id` | Update user | Yes |

### 3.8 Integrations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/integrations` | List integrations | Yes |
| POST | `/api/v1/integrations` | Create integration | Yes |
| GET | `/api/v1/integrations/:id` | Get integration details | Yes |
| PUT | `/api/v1/integrations/:id` | Update integration | Yes |
| DELETE | `/api/v1/integrations/:id` | Delete integration | Yes |

### 3.9 Notifications

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/notifications` | List notifications | Yes |
| PUT | `/api/v1/notifications/:id/read` | Mark as read | Yes |

### 3.10 WebSocket

| Endpoint | Description |
|----------|-------------|
| `/api/v1/ws` | WebSocket for real-time notifications |

---

## 4. Communication Patterns

### 4.1 Synchronous Communication (HTTP)

```
Client → Nginx → Main API → PostgreSQL
Client → Nginx → Main API → MinIO
```

### 4.2 gRPC Communication

The Main API acts as a gRPC client to communicate with Python services:

```
Main API (Go) ────gRPC───→ STT Service (Python:5001)
Main API (Go) ────gRPC───→ AI Analytics (Python:5002)
```

**gRPC Service Definitions:**
- `proto/stt_service.proto` - STT service contracts
- `proto/analytics_service.proto` - Analytics service contracts

### 4.3 Event-Driven Communication

```
Redis Pub/Sub
    ↑
AI Analytics Service
    ↑
Redis Stream (transcript_ready)
    ↑
STT Service
    ↑
BullMQ Queue (audio_processing)
    ↑
Sipuni Listener
```

The Main API subscribes to Redis channels for real-time notification delivery via WebSocket.

### 4.4 Database Access

- **PostgreSQL**: Primary data store for all entities
- **Redis**: Queue management, pub/sub for notifications, caching

---

## 5. Data Flow

### 5.1 Call Processing Pipeline

```
1. Client → Main API → Request call list
2. Main API → PostgreSQL → Fetch calls
3. Main API → Client → Return call data

4. STT Service → PostgreSQL → Save transcript
5. STT Service → Redis Stream → Publish transcript_ready
6. Redis Stream → Main API (Redis Consumer)
7. Main API → WebSocket Hub → Broadcast to Client
```

### 5.2 Authentication Flow

```
1. Client → Main API → POST /auth/register
2. Main API → PostgreSQL → Create user
3. Main API → Client → Return JWT token

4. Client → Main API → Request with JWT
5. Main API → Validate JWT → Process request
```

---

## 6. Database Schema

### 6.1 Key Tables

```
sql
-- Users
users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    company_id UUID,
    role VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Companies
companies (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    settings JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Calls
calls (
    id UUID PRIMARY KEY,
    company_id UUID,
    manager_id VARCHAR(255),
    client_phone VARCHAR(50),
    duration INT,
    call_link TEXT,
    call_date TIMESTAMP,
    status VARCHAR(50),
    source VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Transcripts
transcripts (
    id UUID PRIMARY KEY,
    call_id UUID UNIQUE,
    content JSONB,
    speakers JSONB,
    created_at TIMESTAMP
)

-- Analysis Reports
analysis_reports (
    id UUID PRIMARY KEY,
    call_id UUID UNIQUE,
    quality_score INT,
    script_match FLOAT,
    talk_time_ratio JSONB,
    errors JSONB,
    kpi FLOAT,
    created_at TIMESTAMP
)

-- Teams
teams (
    id UUID PRIMARY KEY,
    company_id UUID,
    name VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Notifications
notifications (
    id UUID PRIMARY KEY,
    user_id UUID,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
)

-- Integrations
integrations (
    id UUID PRIMARY KEY,
    company_id UUID,
    type VARCHAR(50),
    config JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 8080 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | redis://redis:6379 |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRY` | Token expiry duration | 24h |
| `MINIO_ENDPOINT` | MinIO server endpoint | minio:9000 |
| `MINIO_ACCESS_KEY` | MinIO access key | - |
| `MINIO_SECRET_KEY` | MinIO secret key | - |
| `STT_SERVICE_GRPC` | STT service gRPC address | stt-service:5001 |
| `ANALYTICS_GRPC` | AI Analytics gRPC address | ai-analytics:5002 |
| `MIGRATIONS_PATH` | Database migrations path | - |

### 7.2 Docker Configuration

```
yaml
main-api:
  build: ./services/main-api
  ports:
    - "8080:8080"
  environment:
    DATABASE_URL: "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    JWT_SECRET: "mysecret"
    REDIS_URL: "redis://redis:6379"
  depends_on:
    - postgres
    - redis
  volumes:
    - ./services/main-api/internal/infrastructure/database/migrations:/app/internal/infrastructure/database/migrations:ro
```

---

## 8. Monitoring

### 8.1 Metrics

Prometheus metrics are exposed at `/metrics` endpoint:

- `main_api_requests_total` - Total HTTP requests
- `main_api_request_duration_seconds` - Request latency
- `main_api_active_connections` - Active WebSocket connections

### 8.2 Logging

Structured JSON logging using Uber Zap:
- Log level: INFO (configurable)
- Output: stdout (collected by Promtail)
- Format: JSON with timestamp, level, message, fields

---

## 9. Security

### 9.1 Authentication

- JWT-based token authentication
- Tokens include user ID, email, role, company ID
- Token expiry: 24 hours (configurable)

### 9.2 Authorization

Role-Based Access Control (RBAC):
- **Super Admin**: Full system access
- **Admin**: Company management
- **Director**: Team and analytics access
- **Rep**: Own data access only

### 9.3 API Security

- Passwords hashed with bcrypt
- CORS configuration
- Request validation
- Rate limiting (optional)

---

## 10. Dependencies

### 10.1 Internal Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| STT Service | gRPC | Request speech-to-text processing |
| AI Analytics | gRPC | Request call analysis |
| Script Service | HTTP | Manage sales scripts |
| Sipuni Listener | PostgreSQL | Read call records |

### 10.2 External Services

| Service | Integration | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Primary database |
| Redis | Direct | Queue, cache, pub/sub |
| MinIO | S3 Protocol | File storage |

---

## 11. Swagger Documentation

The API includes auto-generated Swagger documentation:

- **Swagger JSON**: `/docs/docs.json`
- **Swagger YAML**: `/docs/swagger.yaml`
- **UI**: Accessible at `/swagger/index.html` (in development)

---

## 12. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [API Contract](../api_contract.md)
- [Database Schema](../database_initial_migration.md)
- [Deployment Guide](../deployment.md)
