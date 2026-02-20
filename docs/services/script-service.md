# Script Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The Script Service is responsible for managing sales scripts in the SalesAI platform. It handles script file uploads, parsing of document content (DOCX/PDF), storage in MinIO, and retrieval operations.

### 1.1 Purpose

- **Script Upload**: Accept multipart file uploads (DOCX, PDF)
- **Content Parsing**: Extract text from document files
- **Storage**: Store original files in MinIO
- **Retrieval**: Provide API for listing and downloading scripts
- **Management**: Delete scripts when no longer needed

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Go | 1.22 |
| Framework | Fiber | 2.52 |
| Database | PostgreSQL | 16 |
| Object Storage | MinIO | Latest |
| Document Parsing | Python | 3.x |
| Monitoring | Prometheus | 2.45.0 |
| Logging | Uber Zap | - |

### 1.3 Service Location

- **Port**: 8083
- **Protocol**: HTTP REST
- **Base Path**: `/api/v1`

---

## 2. Architecture

The Script Service follows **Clean Architecture** principles:

```
services/script-service/
├── cmd/script/
│   └── main.go                    # Entry point
├── internal/
│   ├── adapters/
│   │   ├── http/handlers/         # Upload, List, Download, Delete
│   │   ├── repositories/          # PostgreSQL script repository
│   │   └── storage/              # MinIO client
│   ├── core/
│   │   ├── domain/               # Script entity
│   │   └── usecases/             # Business logic
├── scripts/                       # Python parsers
│   ├── parse_docx.py
│   └── parse_pdf.py
├── requirements.txt               # Python dependencies
├── go.mod
└── go.sum
```

### 2.1 Component Responsibilities

#### Main (cmd/script/main.go)
- Initializes PostgreSQL connection
- Sets up MinIO client
- Registers HTTP routes
- Starts HTTP server

#### Adapters
- **HTTP Handlers**: Process file upload/download requests
- **Repositories**: Database CRUD operations for scripts
- **Storage**: MinIO S3 client for file storage

#### Core
- **Domain**: Script entity definition
- **Usecases**: Business logic for script management

#### Scripts
- **parse_docx.py**: Extract text from DOCX files
- **parse_pdf.py**: Extract text from PDF files

---

## 3. API Endpoints

### 3.1 Scripts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/scripts` | Upload script file | Yes |
| GET | `/api/v1/scripts/:company_id` | List scripts for company | Yes |
| GET | `/api/v1/scripts/:id/download` | Download script file | Yes |
| DELETE | `/api/v1/scripts/:id` | Delete script | Yes |

### 3.2 Request/Response Examples

#### POST /api/v1/scripts

**Request (Multipart Form):**
```
Content-Type: multipart/form-data

company_id: "550e8400-e29b-41d4-a716-446655440000"
file: <binary>
```

**Response (201 Created):**
```
json
{
  "id": "script-uuid",
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "sales_script.docx",
  "content": "Extracted text content...",
  "size": 12345,
  "created_at": "2026-02-01T12:00:00Z"
}
```

#### GET /api/v1/scripts/:company_id

**Response (200 OK):**
```
json
{
  "scripts": [
    {
      "id": "script-uuid",
      "company_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "sales_script.docx",
      "size": 12345,
      "created_at": "2026-02-01T12:00:00Z"
    }
  ]
}
```

---

## 4. Communication Patterns

### 4.1 HTTP Communication

```
Client → Nginx → Script Service → PostgreSQL
Client → Nginx → Script Service → MinIO
```

### 4.2 Storage Flow

```
┌─────────────┐     Upload      ┌─────────────┐
│   Client    │────────────────│ Script Svc  │
└─────────────┘                 └──────┬──────┘
                                       │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                  ┌──────────┐  ┌──────────┐  ┌──────────┐
                  │ MinIO    │  │ PostgreSQL│  │  Python  │
                  │ (File)   │  │ (Metadata)│  │ (Parse)  │
                  └──────────┘  └──────────┘  └──────────┘
```

---

## 5. Processing Flow

### 5.1 Upload Process

1. **Receive File**: Accept multipart form upload
2. **Validate**: Check file type (DOCX/PDF)
3. **Generate UUID**: Create unique script ID
4. **Store File**: Upload original to MinIO
5. **Parse Content**: Extract text using Python scripts
6. **Save Metadata**: Store in PostgreSQL
7. **Return Response**: Send script details to client

### 5.2 Document Parsing

The service uses Python scripts to extract text:

**DOCX Parsing:**
- Uses `python-docx` library
- Extracts text from paragraphs
- Preserves formatting hints (bold, headers)

**PDF Parsing:**
- Uses `pdfplumber` or `PyPDF2`
- Extracts text page by page
- Handles basic layouts

### 5.3 MinIO Storage

- **Bucket**: `scripts`
- **Object Key**: `{company_id}/{script_id}/{filename}`
- **Content-Type**: `application/octet-stream`

---

## 6. Configuration

### 6.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 8083 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `MINIO_ENDPOINT` | MinIO server endpoint | minio:9000 |
| `MINIO_ACCESS_KEY` | MinIO access key | - |
| `MINIO_SECRET_KEY` | MinIO secret key | - |

### 6.2 Docker Configuration

```
yaml
script-service:
  build: ./services/script-service
  ports:
    - "8083:8083"
  environment:
    DATABASE_URL: "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    MINIO_ENDPOINT: "minio:9000"
    MINIO_ACCESS_KEY: "minioadmin"
    MINIO_SECRET_KEY: "minioadmin123"
  depends_on:
    - postgres
    - minio
```

---

## 7. Database Schema

### 7.1 Scripts Table

```
sql
CREATE TABLE scripts (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT,
    size INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scripts_company_id ON scripts(company_id);
```

---

## 8. Error Handling

### 8.1 Upload Errors

- **Invalid File Type**: Return 400 Bad Request
- **File Too Large**: Return 413 Payload Too Large
- **Parse Error**: Store file, save with empty content, log error

### 8.2 Storage Errors

- **MinIO Connection Failed**: Return 503 Service Unavailable
- **Upload Failed**: Return 500 Internal Server Error

### 8.3 Retrieval Errors

- **Script Not Found**: Return 404 Not Found
- **Database Error**: Return 500 Internal Server Error

---

## 9. Logging

Structured JSON logging using Uber Zap:

```
json
{
  "level": "info",
  "ts": "2026-02-01T12:00:00.000Z",
  "caller": "main.go:123",
  "msg": "script-service starting",
  "port": "8083"
}
```

### 9.1 Logged Events

- Service startup
- Upload requests
- File storage operations
- Parsing operations
- Download requests
- Deletion operations
- Errors and warnings

---

## 10. Dependencies

### 10.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Store script metadata |
| MinIO | Direct | Store original files |

### 10.2 External Libraries

| Library | Purpose |
|---------|---------|
| python-docx | DOCX parsing |
| pdfplumber | PDF parsing |

---

## 11. Integration with Other Services

### 11.1 Main API

The Main API uses the Script Service for:
- Listing company scripts
- Downloading scripts for AI analysis
- Uploading new scripts

### 11.2 AI Analytics

AI Analytics Service fetches scripts from:
1. Request to Main API for script content
2. Or direct database query (shared PostgreSQL)

---

## 12. Security

### 12.1 File Validation

- Allowed extensions: `.docx`, `.pdf`
- Maximum file size: 10MB
- Content-Type validation

### 12.2 Access Control

- Company-level isolation (scripts belong to companies)
- No cross-company access

---

## 13. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [Main API Documentation](./main-api.md)
- [AI Analytics Documentation](./ai-analytics.md)
- [Deployment Guide](../deployment.md)
