# Service: Script Management (Sales Script Repository)

## Overview
The `script-service` is a Go service focused on the lifecycle of sales scripts. It allows managers to upload, parse, and version the "Golden Scripts" used for AI coaching.

---

## Responsibilities
- **Script Upload**: Receives DOCX or PDF files and stores them in MinIO.
- **Parsing Engine**: (Optional) Utilizes Python scripts to extract plain text from document formats.
- **Data Persistence**: Stores parsed script text and metadata in PostgreSQL.
- **Script Versioning**: Maintains history of changes to scripts per tenant.

---

## Architecture Role
- **Layer**: Application Layer / Content Management.
- **Service Dependencies**:
  - PostgreSQL (Metadata storage)
  - MinIO (Blob storage)
  - `ai-analytics` (Consumes parsed scripts)

---

## Tenant-Aware Behavior
- **Tenant Context**: Enforces `company_id` for all uploads and retrievals via JWT.
- **Storage Isolation**: Scripts are stored in MinIO using tenant-specific prefixes: `s3://scripts/{tenant_id}/{script_id}.docx`.

---

## Inputs / Outputs

### Inputs
- **File Uploads**: Multipart form data (DOCX/PDF) from the frontend.
- **Metadata**: JSON containing script name and version info.

### Outputs
- **Object Storage**: Files saved to MinIO.
- **Parsed Text**: Extracted content stored in `scripts_schema.scripts`.

---

## Suggested Improvements (Non-Breaking)
- **AI-assisted Parsing**: Integrate with LLMs to automatically structure raw script text into segments (Intro, Objection Handling, etc.).
- **Live Scripting API**: Provide a low-latency API for real-time script lookup during calls.
