# Local Setup Guide for SalesAI

This guide provides instructions for setting up the SalesAI project locally for development and testing.

## Prerequisites

- **Docker & Docker Compose**: For running infrastructure (Postgres, Redis, MinIO, Nginx).
- **Go 1.20+**: For backend services.
- **Node.js 18+ & npm**: For the Vite frontend.
- **Python 3.9+**: For AI services (Analytics & STT).

---

## 1. Infrastructure Setup

Start the core infrastructure services using Docker Compose:

```bash
docker-compose up -d postgres redis minio nginx
```

### Initializing the Database

The migrations are managed automatically by the Go `main-api` or can be run manually using the migration tool:

```bash
cd services/main-api
go run cmd/migrate/main.go
```

---

## 2. Backend Services Setup

You will need to configure `.env` files for each service. Copy the provided `.env.example` files:

### Main API
```bash
cd services/main-api
cp .env.example .env
# Edit .env with your local settings
go run cmd/api/main.go
```

### Script Service
```bash
cd services/script-service
# Port: 8083
go run cmd/script/main.go
```

---

## 3. AI Services Setup (Python)

### AI Analytics
```bash
cd ai-analytics
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### STT Service
```bash
cd stt-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

## 4. Frontend Setup (React + Vite)

```bash
cd services/frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## 5. Environment Variables Summary

### Core Services
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `host=localhost ...` |
| `REDIS_ADDR` | Redis connection string | `localhost:6379` |
| `MINIO_ENDPOINT` | MinIO API endpoint | `localhost:9000` |
| `JWT_SECRET` | Secret key for JWT | `default_secret` |

---

## 6. API Documentation

Swagger documentation is available at:
`http://localhost:8080/swagger/index.html`

To regenerate Swagger docs after making changes to Go handlers:
```bash
cd services/main-api
swag init -g cmd/api/main.go --parseDependency --parseInternal
```
