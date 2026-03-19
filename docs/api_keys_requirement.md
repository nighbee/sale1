# SalesAI - API Keys and Environment Variables Requirement

This document outlines the necessary API keys and environment variables required to run the SalesAI platform services.

## 1. Core Infrastructure

| Variable | Service | Description | Example/Default |
|----------|---------|-------------|-----------------|
| `DATABASE_URL` | All BE services | Connection string for PostgreSQL | `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | All BE services | Connection string for Redis (BullMQ/Streams) | `redis://redis:6379` |
| `JWT_SECRET` | `main-api` | Secret key for signing JWT tokens | `your-secure-secret` |
| `MINIO_ROOT_USER` | `minio` | Root username for MinIO | `minioadmin` |
| `MINIO_ROOT_PASSWORD`| `minio` | Root password for MinIO | `minioadmin123` |

## 2. Telephony (Sipuni)

| Variable | Service | Description | Required |
|----------|---------|-------------|----------|
| `SIPUNI_API_KEY` | `sipuni-listener` | API Key from Sipuni dashboard to authenticate WebSocket connection. | Yes |

## 3. Speech-to-Text (STT)

The `stt-service` supports multiple providers. You need at least one of these:

| Variable | Description | Provider |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for Whisper | `openai` |
| `GOOGLE_API_KEY` | Google Cloud API key for Gemini STT | `gemini` |
| `GROQ_API_KEY` | Groq API key for high-speed Whisper | `groq` |
| `DEEPGRAM_API_KEY`| Deepgram API key | `deepgram` |

**Active Provider Configuration:**
- `STT_PROVIDER`: Set to `openai`, `gemini`, `groq`, or `deepgram`.

## 4. AI Analytics (LLM)

The `ai-analytics` service uses Large Language Models for call analysis.

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | Primary API key for the configured LLM provider. |
| `LLM_BASE_URL` | (Optional) Base URL if using an OpenAI-compatible proxy (e.g., Blackbox AI). |
| `LLM_MODEL` | The specific model name (e.g., `gpt-4-turbo-preview`, `deepseek-v3`). |

## 5. Google Sheets Integration

| Variable | Service | Description |
|----------|---------|-------------|
| `GOOGLE_SHEETS_ID` | `sheets-sync` | ID of the Google Sheet to sync with. |
| `GOOGLE_SERVICE_ACCOUNT_JSON_FILE` | `sheets-sync` | Path to the service account JSON file. |

## 6. Monitoring (Optional)

| Variable | Service | Description |
|----------|---------|-------------|
| `GF_SECURITY_ADMIN_PASSWORD` | `grafana` | Admin password for Grafana dashboard. |
| `LOG_LEVEL` | All | `debug`, `info`, `warn`, `error` |

---

*Note: In production, ensure all secrets are managed securely (e.g., HashiCorp Vault, AWS Secrets Manager) and not committed to version control.*
