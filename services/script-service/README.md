# Script Service

The **Script Service** manages the lifecycle of sales scripts used by the AI Analytics engine to evaluate call quality.

## Overview

- **Language**: Go 1.22+
- **Framework**: [Fiber v2](https://gofiber.io/)
- **Storage**: MinIO (S3-compatible) for document storage
- **Database**: PostgreSQL for script metadata and parsed text

## Responsibilities

1. **Document Upload**: Accepts multipart/form-data uploads of sales scripts (DOCX, PDF).
2. **S3 Storage**: Persists the original documents in MinIO.
3. **Metadata Management**: Stores script details (company ID, file paths, status) in the database.
4. **Parsing**: (Future/Interface) Handles the extraction of text from documents to be used in LLM prompts.

## Folder Structure

### `cmd/script/`
- Contains `main.go`, which initializes the Fiber app, MinIO client, and repositories.

### `internal/adapters/`
- **`http/handlers/`**: Implements endpoints for uploading, listing, downloading, and deleting scripts.
- **`repositories/`**: Manages CRUD operations in the `scripts_schema.scripts` table.
- **`storage/`**: Wraps the MinIO client for file operations.

### `internal/infrastructure/`
- **`logger/`**: Provides structured logging using Zap.

## API Endpoints

- `POST /api/v1/scripts`: Upload a new script file.
- `GET /api/v1/scripts/:company_id`: List all scripts for a specific company.
- `GET /api/v1/scripts/:id/download`: Retrieve the original document from MinIO.
- `DELETE /api/v1/scripts/:id`: Remove a script and its associated file.
