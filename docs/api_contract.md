# SalesAI - API Contract Specification

**Version:** 1.0  
**Date:** February 2026  
**Base URL:** `https://api.salesai.com/api/v1`

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [DTO Definitions](#dto-definitions)
3. [Endpoint Specifications](#endpoint-specifications)
4. [Error Handling](#error-handling)
5. [Pagination & Filtering](#pagination--filtering)
6. [Webhook Payloads](#webhook-payloads)

---

## 1. Authentication & Authorization

### 1.1 JWT Token Structure

**Header:**

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**

```json
{
  "user_id": "uuid",
  "company_id": "uuid",
  "role": "tenant_admin", // super_admin, tenant_admin, sales_rep
  "email": "user@example.com",
  "exp": 1709999999,
  "iat": 1709900000
}
```

**Usage:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.2 Role Permissions Matrix

| Endpoint                      | Super Admin | Tenant Admin | Sales Rep |
| ----------------------------- | ----------- | ------------ | --------- |
| `POST /auth/*`                | ✅          | ✅           | ✅        |
| `GET /users`                  | ✅          | ✅           | ❌        |
| `POST /users/invite`          | ✅          | ✅           | ❌        |
| `GET /calls` (all)            | ✅          | ✅           | ❌        |
| `GET /calls` (own)            | ✅          | ✅           | ✅        |
| `GET /analytics/*`            | ✅          | ✅           | ❌        |
| `POST /scripts`               | ✅          | ✅           | ❌        |
| `PUT /companies/:id/settings` | ✅          | ✅           | ❌        |

---

## 2. DTO Definitions

### 2.1 Auth DTOs

#### `RegisterRequest`

```json
{
  "company_name": "string (required, 3-255 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars, 1 uppercase, 1 number)",
  "manager_name": "string (required)",
  "manager_id": "string (optional, default auto-generated)"
}
```

#### `RegisterResponse`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "tenant_admin",
    "manager_name": "John Doe",
    "created_at": "2026-02-08T10:30:00Z"
  },
  "company": {
    "id": "uuid",
    "name": "Acme Corp",
    "subscription_tier": "basic"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

#### `LoginRequest`

```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

#### `LoginResponse`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "tenant_admin",
    "company_id": "uuid",
    "manager_name": "John Doe"
  },
  "tokens": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 3600
  }
}
```

#### `RefreshTokenRequest`

```json
{
  "refresh_token": "string (required)"
}
```

#### `RefreshTokenResponse`

```json
{
  "access_token": "string",
  "expires_in": 3600
}
```

---

### 2.2 User DTOs

#### `UserDTO`

```json
{
  "id": "uuid",
  "email": "string",
  "role": "tenant_admin | sales_rep | super_admin",
  "manager_id": "string",
  "manager_name": "string",
  "company_id": "uuid",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### `InviteUserRequest`

```json
{
  "email": "string (required)",
  "role": "tenant_admin | sales_rep (required)",
  "manager_name": "string (required)",
  "manager_id": "string (optional)"
}
```

#### `InviteUserResponse`

```json
{
  "user": {
    "id": "uuid",
    "email": "invited@example.com",
    "role": "sales_rep",
    "invitation_sent": true
  },
  "message": "Invitation email sent to invited@example.com"
}
```

#### `UpdateUserRequest`

```json
{
  "manager_name": "string (optional)",
  "role": "string (optional, admin only)"
}
```

---

### 2.3 Call DTOs

#### `CallDTO`

```json
{
  "id": "uuid",
  "company_id": "uuid",
  "manager_id": "string",
  "manager_name": "string",
  "client_phone": "string",
  "client_id": "string",
  "duration": 1321,
  "call_link": "https://files.salebot.pro/.../file.mp3",
  "chat_link": "string (nullable)",
  "call_date": "2025-09-12",
  "call_time": "17:43:00",
  "status": "pending | processing | completed | error",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### `CallDetailDTO`

```json
{
  "call": {
    "id": "uuid",
    "manager_name": "Anzhelika",
    "client_phone": "77081996454",
    "duration": 1321,
    "call_date": "2025-09-12",
    "call_time": "17:43:00",
    "status": "completed",
    "call_link": "https://..."
  },
  "transcript": {
    "id": "uuid",
    "segments": [
      {
        "start": 0.5,
        "end": 3.2,
        "speaker": "SPEAKER_0",
        "text": "Здравствуйте, меня зовут Анжелика"
      }
    ],
    "stt_provider": "whisperx_local",
    "processed_at": "timestamp"
  },
  "analysis": {
    "quality_score": 90,
    "script_match": 95,
    "errors_free": 95,
    "overall_rating": 93.3,
    "kpi": 16439.1,
    "recommendation": "text",
    "brief": "text",
    "next_best_action": "text",
    "llm_provider": "openai",
    "processed_at": "timestamp"
  }
}
```

#### `ListCallsRequest` (Query Params)

```
GET /calls?manager_id=222&status=completed&date_from=2025-09-01&date_to=2025-09-30&page=1&limit=20
```

**Parameters:**

- `manager_id` (string, optional): Filter by manager
- `status` (string, optional): `pending | processing | completed | error`
- `date_from` (date, optional): Start date (YYYY-MM-DD)
- `date_to` (date, optional): End date (YYYY-MM-DD)
- `page` (int, optional, default: 1)
- `limit` (int, optional, default: 20, max: 100)

#### `ListCallsResponse`

```json
{
  "calls": [
    {
      "id": "uuid",
      "manager_name": "Anzhelika",
      "client_phone": "77081996454",
      "duration": 1321,
      "call_date": "2025-09-12",
      "status": "completed",
      "quality_score": 90,
      "overall_rating": 93.3
    }
  ],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

#### `ReprocessCallRequest`

```json
{
  "call_id": "uuid (required)"
}
```

#### `ReprocessCallResponse`

```json
{
  "call_id": "uuid",
  "status": "queued",
  "message": "Call re-queued for processing",
  "estimated_completion": "2026-02-08T10:35:00Z"
}
```

---

### 2.4 Script DTOs

#### `ScriptDTO`

```json
{
  "id": "uuid",
  "company_id": "uuid",
  "name": "string",
  "file_path_minio": "scripts/uuid/script.docx",
  "parsed_text": "string (long text)",
  "version": 1,
  "is_active": true,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### `UploadScriptRequest` (multipart/form-data)

```
POST /scripts
Content-Type: multipart/form-data

name: "Sales Script Q1 2026"
file: [binary DOCX/PDF file]
```

#### `UploadScriptResponse`

```json
{
  "script": {
    "id": "uuid",
    "name": "Sales Script Q1 2026",
    "file_path_minio": "scripts/uuid/script.docx",
    "version": 1,
    "is_active": true,
    "created_at": "timestamp"
  },
  "message": "Script uploaded and parsed successfully"
}
```

#### `ListScriptsResponse`

```json
{
  "scripts": [
    {
      "id": "uuid",
      "name": "Sales Script Q1 2026",
      "version": 1,
      "is_active": true,
      "created_at": "timestamp"
    }
  ]
}
```

#### `GetScriptContentResponse`

```json
{
  "id": "uuid",
  "name": "Sales Script Q1 2026",
  "parsed_text": "# Введение\n\nЗдравствуйте...",
  "created_at": "timestamp"
}
```

---

### 2.5 Company DTOs

#### `CompanyDTO`

```json
{
  "id": "uuid",
  "name": "string",
  "stt_model_preference": "whisperx_local | openai | gemini",
  "llm_provider": "openai | gemini",
  "subscription_tier": "basic | pro | enterprise",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### `UpdateCompanySettingsRequest`

```json
{
  "stt_model_preference": "openai | gemini | whisperx_local (optional)",
  "llm_provider": "openai | gemini (optional)"
}
```

#### `UpdateCompanySettingsResponse`

```json
{
  "company": {
    "id": "uuid",
    "name": "Acme Corp",
    "stt_model_preference": "openai",
    "llm_provider": "gemini",
    "updated_at": "timestamp"
  },
  "message": "Settings updated successfully"
}
```

---

### 2.6 Analytics DTOs

#### `TeamPerformanceRequest` (Query Params)

```
GET /analytics/team-performance?period=last_30_days
```

**Parameters:**

- `period` (string, optional): `last_7_days | last_30_days | last_90_days | custom`
- `date_from` (date, optional, required if period=custom)
- `date_to` (date, optional, required if period=custom)

#### `TeamPerformanceResponse`

```json
{
  "period": {
    "start": "2025-09-01",
    "end": "2025-09-30"
  },
  "managers": [
    {
      "manager_id": "222",
      "manager_name": "Anzhelika",
      "total_calls": 45,
      "avg_quality": 88.5,
      "avg_script_match": 92.1,
      "avg_errors_free": 96.3,
      "avg_overall_rating": 92.3,
      "avg_kpi": 15890.3,
      "total_duration_minutes": 987
    }
  ],
  "totals": {
    "total_calls": 156,
    "avg_quality": 85.2,
    "avg_kpi": 14523.7
  }
}
```

#### `LeaderboardResponse`

```json
{
  "period": {
    "start": "2025-09-01",
    "end": "2025-09-30"
  },
  "leaderboard": [
    {
      "rank": 1,
      "manager_id": "222",
      "manager_name": "Anzhelika",
      "total_calls": 45,
      "avg_overall_rating": 92.3,
      "avg_kpi": 15890.3
    },
    {
      "rank": 2,
      "manager_id": "111",
      "manager_name": "Darina",
      "total_calls": 38,
      "avg_overall_rating": 89.1,
      "avg_kpi": 14200.5
    }
  ]
}
```

#### `TrendsResponse`

```json
{
  "period": {
    "start": "2025-09-01",
    "end": "2025-09-30"
  },
  "daily_trends": [
    {
      "date": "2025-09-01",
      "total_calls": 12,
      "avg_quality": 87.3,
      "avg_kpi": 14890.2
    }
  ],
  "top_issues": [
    {
      "issue": "Не следует скрипту в фазе закрытия",
      "count": 23,
      "percentage": 15.2
    }
  ]
}
```

---

### 2.7 Notification DTOs

#### `NotificationDTO`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "email | telegram | in_app",
  "message": "string",
  "is_read": false,
  "sent_at": "timestamp"
}
```

---

## 3. Endpoint Specifications

### 3.1 Auth Endpoints

#### `POST /auth/register`

**Description:** Register a new company and admin user

**Request Body:** `RegisterRequest`

**Response:** `201 Created` → `RegisterResponse`

**Errors:**

- `400 Bad Request` - Invalid input
- `409 Conflict` - Email already exists

**Example:**

```bash
curl -X POST https://api.salesai.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "email": "admin@acme.com",
    "password": "SecurePass123",
    "manager_name": "John Doe"
  }'
```

---

#### `POST /auth/login`

**Description:** Login and receive JWT tokens

**Request Body:** `LoginRequest`

**Response:** `200 OK` → `LoginResponse`

**Errors:**

- `401 Unauthorized` - Invalid credentials

**Example:**

```bash
curl -X POST https://api.salesai.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123"
  }'
```

---

#### `POST /auth/refresh`

**Description:** Refresh access token using refresh token

**Request Body:** `RefreshTokenRequest`

**Response:** `200 OK` → `RefreshTokenResponse`

**Errors:**

- `401 Unauthorized` - Invalid refresh token

---

#### `POST /auth/logout`

**Description:** Invalidate refresh token

**Headers:** `Authorization: Bearer <token>`

**Response:** `204 No Content`

---

#### `POST /auth/forgot-password`

**Description:** Send password reset email

**Request Body:**

```json
{
  "email": "string"
}
```

**Response:** `200 OK`

```json
{
  "message": "Password reset email sent"
}
```

---

#### `POST /auth/reset-password`

**Description:** Reset password with token from email

**Request Body:**

```json
{
  "token": "string",
  "new_password": "string"
}
```

**Response:** `200 OK`

---

### 3.2 User Endpoints

#### `GET /users`

**Auth Required:** Yes (Admin only)

**Description:** List all users in company

**Response:** `200 OK`

```json
{
  "users": [UserDTO]
}
```

---

#### `POST /users/invite`

**Auth Required:** Yes (Admin only)

**Request Body:** `InviteUserRequest`

**Response:** `201 Created` → `InviteUserResponse`

---

#### `GET /users/:id`

**Auth Required:** Yes

**Response:** `200 OK` → `UserDTO`

**Errors:**

- `403 Forbidden` - Cannot view other users (if Sales Rep)
- `404 Not Found` - User not found

---

#### `PUT /users/:id`

**Auth Required:** Yes (Admin or self)

**Request Body:** `UpdateUserRequest`

**Response:** `200 OK` → `UserDTO`

---

#### `DELETE /users/:id`

**Auth Required:** Yes (Admin only)

**Response:** `204 No Content`

---

### 3.3 Call Endpoints

#### `GET /calls`

**Auth Required:** Yes

**Query Params:** See `ListCallsRequest`

**Response:** `200 OK` → `ListCallsResponse`

**Business Logic:**

- Sales Reps only see their own calls (`manager_id` auto-injected)
- Admins see all calls in company

---

#### `GET /calls/:id`

**Auth Required:** Yes

**Response:** `200 OK` → `CallDetailDTO`

**Errors:**

- `403 Forbidden` - Cannot view other manager's calls (if Sales Rep)
- `404 Not Found`

---

#### `GET /calls/:id/transcript`

**Auth Required:** Yes

**Response:** `200 OK`

```json
{
  "call_id": "uuid",
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "speaker": "SPEAKER_0",
      "text": "Здравствуйте"
    }
  ],
  "stt_provider": "whisperx_local"
}
```

---

#### `GET /calls/:id/analysis`

**Auth Required:** Yes

**Response:** `200 OK`

```json
{
  "call_id": "uuid",
  "quality_score": 90,
  "script_match": 95,
  "errors_free": 95,
  "overall_rating": 93.3,
  "kpi": 16439.1,
  "recommendation": "text",
  "brief": "text",
  "next_best_action": "text"
}
```

---

#### `GET /calls/:id/audio`

**Auth Required:** Yes

**Description:** Stream audio file from MinIO

**Response:** `200 OK` (audio/mpeg)

**Headers:**

```
Content-Type: audio/mpeg
Content-Disposition: inline; filename="call.mp3"
```

---

#### `POST /calls/:id/reprocess`

**Auth Required:** Yes (Admin only)

**Description:** Re-queue failed call for processing

**Request Body:** Empty or `{}`

**Response:** `200 OK` → `ReprocessCallResponse`

**Errors:**

- `400 Bad Request` - Call already processing
- `404 Not Found`

---

### 3.4 Script Endpoints

#### `POST /scripts`

**Auth Required:** Yes (Admin only)

**Content-Type:** `multipart/form-data`

**Request:** `UploadScriptRequest`

**Response:** `201 Created` → `UploadScriptResponse`

**Errors:**

- `400 Bad Request` - Invalid file type (only DOCX/PDF)
- `413 Payload Too Large` - File > 10MB

---

#### `GET /scripts`

**Auth Required:** Yes

**Response:** `200 OK` → `ListScriptsResponse`

---

#### `GET /scripts/:id`

**Auth Required:** Yes

**Response:** `200 OK` → `ScriptDTO`

---

#### `GET /scripts/:id/content`

**Auth Required:** Yes

**Description:** Get parsed text content of script

**Response:** `200 OK` → `GetScriptContentResponse`

---

#### `PUT /scripts/:id`

**Auth Required:** Yes (Admin only)

**Description:** Update script metadata (not file)

**Request Body:**

```json
{
  "name": "string (optional)",
  "is_active": "boolean (optional)"
}
```

**Response:** `200 OK` → `ScriptDTO`

---

#### `DELETE /scripts/:id`

**Auth Required:** Yes (Admin only)

**Description:** Soft delete (set is_active = false)

**Response:** `204 No Content`

---

### 3.5 Company Endpoints

#### `GET /companies/:id`

**Auth Required:** Yes (Admin only)

**Response:** `200 OK` → `CompanyDTO`

---

#### `PUT /companies/:id/settings`

**Auth Required:** Yes (Admin only)

**Request Body:** `UpdateCompanySettingsRequest`

**Response:** `200 OK` → `UpdateCompanySettingsResponse`

**Example:**

```bash
curl -X PUT https://api.salesai.com/api/v1/companies/uuid/settings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stt_model_preference": "openai",
    "llm_provider": "gemini"
  }'
```

---

### 3.6 Analytics Endpoints

#### `GET /analytics/team-performance`

**Auth Required:** Yes (Admin only)

**Query Params:** See `TeamPerformanceRequest`

**Response:** `200 OK` → `TeamPerformanceResponse`

---

#### `GET /analytics/leaderboard`

**Auth Required:** Yes (Admin only)

**Query Params:** Same as team-performance

**Response:** `200 OK` → `LeaderboardResponse`

---

#### `GET /analytics/trends`

**Auth Required:** Yes (Admin only)

**Query Params:** Same as team-performance

**Response:** `200 OK` → `TrendsResponse`

---

### 3.7 Webhook Endpoints (External)

#### `POST /webhooks/amocrm/call-finished`

**Auth:** API Key in header `X-API-Key: <amocrm_key>`

**Description:** Receive call finished events from AmoCRM

**Request Body:**

```json
{
  "event_type": "call_finished",
  "manager_id": "222",
  "manager_name": "Anzhelika",
  "client_phone": "77081996454",
  "client_id": "33817535",
  "duration": 1321,
  "call_link": "https://files.salebot.pro/.../file.mp3",
  "chat_link": "https://...",
  "timestamp": "2025-09-12T17:43:00Z"
}
```

**Response:** `200 OK`

```json
{
  "status": "received",
  "call_id": "uuid",
  "message": "Call queued for processing"
}
```

**Performance Requirement:** Must respond within 100ms

---

## 4. Error Handling

### 4.1 Error Response Format

**Standard Error Response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "timestamp": "2026-02-08T10:30:00Z",
    "request_id": "uuid"
  }
}
```

### 4.2 Error Codes

| HTTP Status | Error Code              | Description                |
| ----------- | ----------------------- | -------------------------- |
| 400         | `VALIDATION_ERROR`      | Invalid request parameters |
| 401         | `UNAUTHORIZED`          | Missing or invalid token   |
| 403         | `FORBIDDEN`             | Insufficient permissions   |
| 404         | `NOT_FOUND`             | Resource not found         |
| 409         | `CONFLICT`              | Resource already exists    |
| 413         | `PAYLOAD_TOO_LARGE`     | File size exceeds limit    |
| 422         | `UNPROCESSABLE_ENTITY`  | Business logic error       |
| 429         | `RATE_LIMIT_EXCEEDED`   | Too many requests          |
| 500         | `INTERNAL_SERVER_ERROR` | Server error               |
| 503         | `SERVICE_UNAVAILABLE`   | Service temporarily down   |

### 4.3 Validation Rules

**Email:**

- Format: RFC 5322 compliant
- Max length: 255 characters

**Password:**

- Min length: 8 characters
- Must contain: 1 uppercase, 1 lowercase, 1 number
- Optional: 1 special character

**Manager ID:**

- Pattern: `^[0-9]{1,10}$`
- Example: "222", "111"

**Phone:**

- Pattern: `^[0-9]{10,15}$`
- Example: "77081996454"

**Date:**

- Format: YYYY-MM-DD
- Example: "2025-09-12"

**Time:**

- Format: HH:MM:SS
- Example: "17:43:00"

---

## 5. Pagination & Filtering

### 5.1 Pagination Parameters

**Query Params:**

```
?page=1&limit=20
```

**Response:**

```json
{
  "data": [...],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

**Limits:**

- Default `limit`: 20
- Max `limit`: 100
- Min `limit`: 1

---

### 5.2 Filtering Examples

**Calls by manager and date range:**

```
GET /calls?manager_id=222&date_from=2025-09-01&date_to=2025-09-30
```

**Calls by status:**

```
GET /calls?status=error
```

**Multiple filters:**

```
GET /calls?manager_id=222&status=completed&page=2&limit=50
```

---

### 5.3 Sorting

**Query Param:**

```
?sort_by=call_date&order=desc
```

**Supported Fields:**

- `call_date` (default)
- `duration`
- `quality_score`
- `overall_rating`
- `created_at`

**Orders:**

- `asc` (ascending)
- `desc` (descending, default)

---

## 6. Webhook Payloads

### 6.1 AmoCRM Call Finished

**URL:** `POST /webhooks/amocrm/call-finished`

**Headers:**

```
Content-Type: application/json
X-API-Key: <amocrm_secret_key>
```

**Payload:**

```json
{
  "event_type": "call_finished",
  "manager_id": "222",
  "manager_name": "Anzhelika",
  "client_phone": "77081996454",
  "client_id": "33817535",
  "duration": 1321,
  "call_link": "https://files.salebot.pro/uploads/file_item/51965265/file/698408/2024_09_21-09_12_37_from_222_to_87023503754.mp3",
  "chat_link": "https://example.com/chat/123",
  "timestamp": "2025-09-12T17:43:00Z"
}
```

**Response:**

```json
{
  "status": "received",
  "call_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Call queued for processing"
}
```

---

### 6.2 Google Sheets Webhook (Optional Future)

**URL:** `POST /webhooks/google-sheets`

**Payload:**

```json
{
  "event_type": "row_added",
  "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "row_data": {
    "Date": "12.09.2025",
    "Time": "17:43",
    "Man id": "222",
    "Man name": "Anzhelika",
    "Client phone": "77081996454",
    "Duration": 1321,
    "Call Link": "https://..."
  }
}
```

---

## 7. Rate Limiting

### 7.1 Rate Limit Headers

**Response Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1709999999
```

### 7.2 Limits by Role

| Role         | Requests/Hour |
| ------------ | ------------- |
| Super Admin  | 10,000        |
| Tenant Admin | 5,000         |
| Sales Rep    | 1,000         |
| Webhook      | Unlimited     |

---

## 8. Versioning

**Current Version:** `v1`

**URL Format:** `https://api.salesai.com/api/v1/*`

**Version Header (Optional):**

```
Accept: application/vnd.salesai.v1+json
```

---

## 9. CORS Configuration

**Allowed Origins:**

- `https://app.salesai.com`
- `http://localhost:3000` (development)

**Allowed Methods:**

- `GET, POST, PUT, DELETE, OPTIONS`

**Allowed Headers:**

- `Authorization, Content-Type, X-Request-ID`

---

## 10. OpenAPI (Swagger) Specification

**Swagger UI:** `https://api.salesai.com/api/v1/docs`

**OpenAPI JSON:** `https://api.salesai.com/api/v1/openapi.json`

---

## 11. Testing Examples

### 11.1 Complete User Flow (cURL)

**1. Register:**

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Corp",
    "email": "admin@test.com",
    "password": "Test1234",
    "manager_name": "Test Admin"
  }'
```

**2. Login:**

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test1234"
  }'
```

**3. Get Calls:**

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET "http://localhost:8080/api/v1/calls?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**4. Upload Script:**

```bash
curl -X POST http://localhost:8080/api/v1/scripts \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Sales Script Q1" \
  -F "file=@script.docx"
```

**5. Update Settings:**

```bash
curl -X PUT http://localhost:8080/api/v1/companies/{company_id}/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stt_model_preference": "openai",
    "llm_provider": "gemini"
  }'
```

---

## 12. WebSocket Support (Future)

**Endpoint:** `wss://api.salesai.com/ws`

**Use Cases:**

- Real-time call processing status updates
- Live transcript streaming
- Notifications

**Message Format:**

```json
{
  "type": "call_status_update",
  "call_id": "uuid",
  "status": "processing",
  "progress": 45,
  "message": "Transcribing audio..."
}
```

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026  
**Maintained By:** API Team
