# Multi-Tenant Model & Data Isolation

## Overview
SalesAI is built as a multi-tenant SaaS platform where multiple companies (tenants) share the same application infrastructure while their data remains logically isolated.

---

## 1. Tenant Definition
A **Tenant** (Company) is the top-level entity.

- **Entity**: `auth_schema.companies`.
- **Attributes**: `id`, `name`, `stt_model_preference`, `llm_provider`, `is_active`.
- **Hierarchical Linking**: All `users`, `calls`, `transcripts`, `analysis_reports`, and `scripts` are linked to a single `company_id`.

---

## 2. Isolation Strategy

### 2.1 Database Isolation
SalesAI uses the **Shared Database, Shared Schema** approach with **Row-Level Filtering**.

- **Enforcement**: All database queries MUST include a `WHERE company_id = ?` clause.
- **Repository Implementation**: Repository methods are designed to accept `company_id` as a mandatory parameter to ensure developers cannot inadvertently fetch data from other tenants.

### 2.2 Storage Isolation (MinIO)
Tenant data in object storage is isolated via **Bucket Prefixing**.

- **Structure**: `s3://[bucket]/[tenant_id]/[object_type]/[object_id]`
- **Examples**:
  - `s3://audio/550e8400-e29b-41d4-a716-446655440000/call_880e.mp3`
  - `s3://scripts/550e8400-e29b-41d4-a716-446655440000/script_q1.docx`

### 2.3 Configuration Isolation
Global AI configuration (STT provider, LLM model) is stored per-tenant.

- **Dynamic Loading**: Services load the current tenant's `AISettings` before executing any AI-related tasks.
- **Circuit Breaker**: Individual circuit breakers track the health of each provider per-tenant, ensuring that a faulty API key for one tenant does not disrupt others.

---

## 3. RBAC (Role-Based Access Control)
Isolation is also enforced at the user level within a tenant.

| Role | Access Scope |
| :--- | :--- |
| **Super Admin** | System-wide access to all tenants and global logs. |
| **Tenant Admin** | Access to all data within their own tenant (all calls, all users). |
| **Sales Rep** | Access only to their own call records and individual performance metrics. |

---

## 4. Security Enforcement
- **JWT Claims**: The `company_id` (tenant_id) is embedded in the JWT claims during login.
- **Middleware Validation**: The `main-api` middleware extracts and validates the `company_id` on every request.
- **Webhook Security**: Sipuni webhooks are validated by resolving the `company_id` from the API Key or shared secret provided by the tenant.

---

## Suggested Improvements (Non-Breaking)
- **Database Schema per Tenant**: (Future) Move to a "Schema-per-Tenant" model for enterprise customers requiring dedicated database schemas for compliance.
- **Audit Logs**: Implement tenant-specific audit logs to track all administrative actions (e.g., script changes, user deletion).
