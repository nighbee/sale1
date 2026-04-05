# Service: Main API (Go Orchestrator)

## Overview
The `main-api` is the core orchestrator and the primary API for the SalesAI system. It handles authentication, data CRUD (Create, Read, Update, Delete), and aggregates analysis reports for display.

---

## Responsibilities
- **Authentication & Authorization**: Manages users, companies, and JWT-based session security.
- **Tenant Context Enforcement**: Resolves `tenant_id` from JWT and injects it into all database queries.
- **Resource Management**: CRUD operations for calls, transcripts, scripts, and integrations.
- **Reporting & Analytics**: Aggregates and serves call metrics (Quality Scores, Script Match, etc.).

---

## Architecture Role
- **Layer**: Application Layer / Orchestrator.
- **Service Dependencies**:
  - PostgreSQL (Primary store)
  - Redis (Queueing trigger)
  - MinIO (Script/Media metadata)

---

## Tenant-Aware Behavior
The service uses a middleware-first approach for tenant isolation.
- **JWT Middleware**: Extracts `tenant_id` (company_id) from the token.
- **Repository Isolation**: Repositories use the extracted `tenant_id` as a mandatory filter (e.g., `WHERE company_id = $1`).
- **Config Isolation**: Each tenant's STT/LLM preferences are loaded dynamically during request processing.

---

## Internal Modules (Logical)
- **Adapters**:
  - `http`: REST handlers and routing.
  - `grpc`: (Optional) Communication with AI services.
  - `repositories`: Postgres and Redis implementations.
- **Core Domain**: Enterprise entities (User, Call, Script, Tenant/Company).
- **Use Cases**: Business logic (Process call, Generate report, Script management).

---

## Inputs / Outputs

### Inputs
- **REST Requests**: From frontend (JSON payloads).
- **Authentication**: JWT Bearer tokens.

### Outputs
- **JSON Responses**: Data for the frontend.
- **Queued Jobs**: Pushes jobs to BullMQ for STT and Analytics.
- **Database Operations**: SQL queries to PostgreSQL.

---

## Suggested Improvements (Non-Breaking)
- **Tenant Resolution Middleware**: Refine the middleware to support both header-based (`X-Tenant-ID`) and JWT-based resolution for internal vs external API calls.
- **API Versioning**: Enforce strict versioning (`/v1`, `/v2`) to maintain backward compatibility during feature evolution.
