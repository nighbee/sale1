# SalesAI - Deployment Guide

**Version:** 1.0  
**Date:** February 2026

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Docker Configuration](#docker-configuration)
3. [Environment Variables](#environment-variables)
4. [Service Configuration Files](#service-configuration-files)
5. [Production Deployment](#production-deployment)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)

---

## 1. Local Development Setup

### 1.1 Prerequisites

**Required Software:**

- Docker Desktop 24.0+
- Docker Compose 2.23+
- Go 1.22+ (for local development)
- Python 3.11+ (for AI services development)
- Node.js 18+ (for frontend, if separate)
- Git

**System Requirements:**

- CPU: 4+ cores
- RAM: 16GB minimum (STT service requires 4GB)
- Disk: 50GB available

---

### 1.2 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/salesai.git
cd salesai

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
nano .env  # or your preferred editor

# 4. Start infrastructure
docker-compose up -d postgres redis minio

# 5. Wait for databases to be ready (15 seconds)
sleep 15

# 6. Run migrations
cd services/main-api
go run cmd/migrate/main.go

# 7. Start all services
cd ../..
docker-compose up -d

# 8. Check service health
docker-compose ps
curl http://localhost:8080/health
curl http://localhost:5001/health
curl http://localhost:5002/health
```

**Access:**

- Main API: http://localhost:8080
- STT Service: http://localhost:5001
- AI Analytics: http://localhost:5002
- MinIO Console: http://localhost:9001 (minioadmin / minioadmin123)
- PostgreSQL: localhost:5432 (salesai_user / password)

---

### 1.3 Development Workflow

**Option A: Full Docker (Recommended for testing)**

```bash
docker-compose up -d
docker-compose logs -f main-api  # View logs
docker-compose restart stt-service  # Restart specific service
```

**Option B: Hybrid (Services in Docker, code locally)**

```bash
# Start infrastructure only
docker-compose up -d postgres redis minio

# Run services locally
cd services/main-api
go run cmd/api/main.go

# In another terminal
cd services/stt-service
python main.py
```

---

## 2. Docker Configuration

### 2.1 Complete docker-compose.yml

```yaml
version: "3.8"

services:
  # =============================================
  # Infrastructure
  # =============================================

  postgres:
    image: postgres:16-alpine
    container_name: salesai-postgres
    environment:
      POSTGRES_DB: salesai
      POSTGRES_USER: salesai_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/001_init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U salesai_user -d salesai"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - salesai-network
    restart: unless-stopped

  redis:
    image: redis:7.2-alpine
    container_name: salesai-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - salesai-network
    restart: unless-stopped

  minio:
    image: minio/minio:RELEASE.2024-01-01T16-36-33Z
    container_name: salesai-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - salesai-network
    restart: unless-stopped

  # =============================================
  # Golang Services
  # =============================================

  main-api:
    build:
      context: ./services/main-api
      dockerfile: Dockerfile
      args:
        GO_VERSION: "1.22"
    container_name: salesai-main-api
    environment:
      # Database
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}

      # Redis
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}

      # MinIO
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      MINIO_USE_SSL: "false"

      # App
      PORT: 8080
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRY: 3600
      ENV: ${ENV:-development}

      # gRPC
      GRPC_STT_HOST: stt-service:5001
      GRPC_ANALYTICS_HOST: ai-analytics:5002
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - salesai-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  webhook-service:
    build:
      context: ./services/webhook-service
      dockerfile: Dockerfile
    container_name: salesai-webhook
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      PORT: 8081
      AMOCRM_WEBHOOK_SECRET: ${AMOCRM_WEBHOOK_SECRET}
    ports:
      - "8081:8081"
    depends_on:
      - postgres
      - redis
    networks:
      - salesai-network
    restart: unless-stopped

  sheets-sync:
    build:
      context: ./services/sheets-sync
      dockerfile: Dockerfile
    container_name: salesai-sheets-sync
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      GOOGLE_SHEETS_CREDS: /secrets/google-sheets.json
      SYNC_INTERVAL_MINUTES: 5
    volumes:
      - ./secrets:/secrets:ro
    depends_on:
      - postgres
      - redis
    networks:
      - salesai-network
    restart: unless-stopped

  script-service:
    build:
      context: ./services/script-service
      dockerfile: Dockerfile
    container_name: salesai-script-service
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      PORT: 8083
    ports:
      - "8083:8083"
    depends_on:
      - postgres
      - minio
    networks:
      - salesai-network
    restart: unless-stopped

  # =============================================
  # Python Services
  # =============================================

  stt-service:
    build:
      context: ./services/stt-service
      dockerfile: Dockerfile
      args:
        PYTHON_VERSION: "3.11"
    container_name: salesai-stt
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}

      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}

      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}

      # API Keys
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GOOGLE_APPLICATION_CREDENTIALS: /secrets/google-cloud.json

      # App
      PORT: 5001
      WORKERS: 2
      LOG_LEVEL: ${LOG_LEVEL:-info}
    volumes:
      - ./secrets:/secrets:ro
      - /tmp/audio:/tmp/audio
      - stt_models:/app/models # Cache downloaded models
    ports:
      - "5001:5001"
    depends_on:
      - postgres
      - redis
      - minio
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: "2"
        reservations:
          memory: 2G
    networks:
      - salesai-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
      interval: 60s
      timeout: 10s
      retries: 3

  ai-analytics:
    build:
      context: ./services/ai-analytics
      dockerfile: Dockerfile
    container_name: salesai-ai-analytics
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: salesai
      DB_USER: salesai_user
      DB_PASSWORD: ${POSTGRES_PASSWORD}

      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}

      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}

      # API Keys
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}

      # App
      PORT: 5002
      WORKERS: 1
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      - "5002:5002"
    depends_on:
      - postgres
      - redis
      - minio
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "1"
    networks:
      - salesai-network
    restart: unless-stopped

  # =============================================
  # API Gateway
  # =============================================

  nginx:
    image: nginx:1.25-alpine
    container_name: salesai-nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro # SSL certificates
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - main-api
      - webhook-service
    networks:
      - salesai-network
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  minio_data:
    driver: local
  stt_models:
    driver: local

networks:
  salesai-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

### 2.2 Service Dockerfiles

#### Main API (Golang)

**File:** `services/main-api/Dockerfile`

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/api/main.go

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install CA certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy binary from builder
COPY --from=builder /app/main .

# Copy migrations
COPY --from=builder /app/internal/infrastructure/database/migrations ./migrations

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["./main"]
```

---

#### STT Service (Python)

**File:** `services/stt-service/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download WhisperX models (optional, can be done at runtime)
# RUN python -c "import whisperx; whisperx.load_model('large-v2', device='cpu')"

# Copy source code
COPY . .

# Create temp directory for audio processing
RUN mkdir -p /tmp/audio && chmod 777 /tmp/audio

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

# Run with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "2"]
```

**File:** `services/stt-service/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.6.0
pydantic-settings==2.1.0
psycopg2-binary==2.9.9
redis==5.0.1
minio==7.2.3
whisperx==3.1.1
pyannote.audio==3.1.1
openai==1.12.0
google-cloud-speech==2.24.0
torch==2.1.2
torchaudio==2.1.2
numpy==1.26.3
scipy==1.11.4
librosa==0.10.1
soundfile==0.12.1
pydub==0.25.1
grpcio==1.60.1
grpcio-tools==1.60.1
python-dotenv==1.0.1
```

---

#### AI Analytics Service (Python)

**File:** `services/ai-analytics/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5002/health || exit 1

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002", "--workers", "1"]
```

**File:** `services/ai-analytics/requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.6.0
pydantic-settings==2.1.0
psycopg2-binary==2.9.9
redis==5.0.1
minio==7.2.3
openai==1.12.0
google-generativeai==0.3.2
langchain==0.1.6
langchain-openai==0.0.5
grpcio==1.60.1
grpcio-tools==1.60.1
python-dotenv==1.0.1
```

---

## 3. Environment Variables

### 3.1 .env.example

```env
# =============================================
# SalesAI Environment Configuration
# Copy to .env and fill in your values
# =============================================

# Environment
ENV=development  # development, staging, production

# Database
POSTGRES_PASSWORD=strong_password_here_123

# Redis
REDIS_PASSWORD=redis_password_here_456

# MinIO (S3-compatible storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin_strong_password_789

# JWT
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long

# AI API Keys
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...

# AmoCRM
AMOCRM_WEBHOOK_SECRET=your_amocrm_webhook_secret

# Google Sheets (optional)
GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Logging
LOG_LEVEL=info  # debug, info, warning, error

# Feature Flags (optional)
ENABLE_WEB_SEARCH=false
ENABLE_NOTIFICATIONS=true
```

---

### 3.2 Secrets Management

**For Production:**

Use Docker Secrets or environment-specific secret management:

```bash
# Create secrets directory (gitignored)
mkdir -p secrets

# Google Sheets credentials
# Download from Google Cloud Console → Service Account → Keys
cp ~/Downloads/service-account.json secrets/google-sheets.json

# Google Cloud STT credentials
cp ~/Downloads/google-cloud-key.json secrets/google-cloud.json
```

**Docker Compose with Secrets:**

```yaml
services:
  stt-service:
    secrets:
      - google_cloud_creds
    environment:
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/google_cloud_creds

secrets:
  google_cloud_creds:
    file: ./secrets/google-cloud.json
```

---

## 4. Service Configuration Files

### 4.1 Nginx Configuration

**File:** `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    upstream main_api {
        server main-api:8080;
    }

    upstream webhook_service {
        server webhook-service:8081;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=1000r/m;

    server {
        listen 80;
        server_name api.salesai.com;

        # Redirect to HTTPS in production
        # return 301 https://$server_name$request_uri;

        # Main API
        location /api/v1 {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://main_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Webhooks (must be fast)
        location /api/v1/webhooks {
            limit_req zone=webhook_limit burst=100 nodelay;

            proxy_pass http://webhook_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;

            # Fast timeouts for webhooks
            proxy_connect_timeout 2s;
            proxy_send_timeout 2s;
            proxy_read_timeout 2s;
        }

        # Health check
        location /health {
            proxy_pass http://main_api/health;
        }

        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;

        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # HTTPS configuration (production)
    # server {
    #     listen 443 ssl http2;
    #     server_name api.salesai.com;
    #
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #
    #     # Same locations as above
    # }
}
```

---

## 5. Production Deployment

### 5.1 Pre-Deployment Checklist

- [ ] All environment variables set
- [ ] SSL certificates obtained (Let's Encrypt)
- [ ] Database backups configured
- [ ] Monitoring setup (Grafana/Prometheus)
- [ ] Log aggregation configured
- [ ] MinIO buckets created
- [ ] Domain DNS configured
- [ ] Firewall rules applied
- [ ] Load balancer configured (if needed)

---

### 5.2 Production docker-compose.yml

```yaml
version: "3.8"

services:
  # ... (same as development, with additions:)

  # Add resource limits
  main-api:
    # ...
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1"
        reservations:
          memory: 256M
          cpus: "0.5"
      replicas: 2 # Scale horizontally
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s

  # Add monitoring
  prometheus:
    image: prom/prometheus:v2.48.0
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - salesai-network

  grafana:
    image: grafana/grafana:10.2.0
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    networks:
      - salesai-network

volumes:
  prometheus_data:
  grafana_data:
```

---

### 5.3 CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: "1.22"

      - name: Run tests
        run: |
          cd services/main-api
          go test ./...

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"

      - name: Test Python services
        run: |
          cd services/stt-service
          pip install -r requirements.txt
          pytest

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push images
        run: |
          docker-compose build
          docker-compose push

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/salesai
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T postgres pg_dump salesai > backup_$(date +%Y%m%d).sql
```

---

## 6. Monitoring & Logging

### 6.1 Prometheus Configuration

**File:** `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "main-api"
    static_configs:
      - targets: ["main-api:8080"]

  - job_name: "stt-service"
    static_configs:
      - targets: ["stt-service:5001"]

  - job_name: "ai-analytics"
    static_configs:
      - targets: ["ai-analytics:5002"]

  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]
```

---

### 6.2 Logging Configuration

**Centralized Logging with Loki (Optional):**

```yaml
loki:
  image: grafana/loki:2.9.0
  ports:
    - "3100:3100"
  command: -config.file=/etc/loki/local-config.yaml
  networks:
    - salesai-network

promtail:
  image: grafana/promtail:2.9.0
  volumes:
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
    - ./monitoring/promtail-config.yml:/etc/promtail/config.yml
  command: -config.file=/etc/promtail/config.yml
  networks:
    - salesai-network
```

---

## 7. Backup & Recovery

### 7.1 Automated Backups

**File:** `scripts/backup.sh`

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/backups/salesai"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# PostgreSQL backup
docker-compose exec -T postgres pg_dump -U salesai_user salesai > \
    $BACKUP_DIR/postgres_$TIMESTAMP.sql

# MinIO backup (export objects)
docker-compose exec -T minio mc mirror salesai/scripts \
    $BACKUP_DIR/minio_scripts_$TIMESTAMP

# Compress
tar -czf $BACKUP_DIR/backup_$TIMESTAMP.tar.gz \
    $BACKUP_DIR/postgres_$TIMESTAMP.sql \
    $BACKUP_DIR/minio_scripts_$TIMESTAMP

# Cleanup old backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: backup_$TIMESTAMP.tar.gz"
```

**Cron job:**

```bash
# Run daily at 2 AM
0 2 * * * /opt/salesai/scripts/backup.sh >> /var/log/salesai-backup.log 2>&1
```

---

### 7.2 Restore Procedure

```bash
#!/bin/bash

BACKUP_FILE=$1

# Extract
tar -xzf $BACKUP_FILE

# Restore PostgreSQL
cat postgres_*.sql | docker-compose exec -T postgres psql -U salesai_user salesai

# Restore MinIO
docker-compose exec -T minio mc mirror --overwrite \
    /tmp/minio_scripts_* salesai/scripts

echo "Restore completed"
```

---

## 8. Troubleshooting

### 8.1 Common Issues

**Issue: Services won't start**

```bash
# Check logs
docker-compose logs -f

# Check specific service
docker-compose logs stt-service

# Restart services
docker-compose restart
```

**Issue: Database connection failed**

```bash
# Test connection
docker-compose exec postgres psql -U salesai_user -d salesai -c "SELECT 1;"

# Check health
docker-compose ps
```

**Issue: Out of memory (STT service)**

```bash
# Increase Docker memory limit in Docker Desktop
# Or reduce workers in STT service
```

---

### 8.2 Performance Tuning

**PostgreSQL:**

```sql
-- Increase shared_buffers
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
SELECT pg_reload_conf();
```

**Redis:**

```bash
# Increase maxmemory
docker-compose exec redis redis-cli CONFIG SET maxmemory 512mb
```

---

## 9. Security Hardening

### 9.1 Production Checklist

- [ ] Change all default passwords
- [ ] Use SSL/TLS for all connections
- [ ] Enable firewall (ufw/iptables)
- [ ] Disable root SSH login
- [ ] Use fail2ban for brute-force protection
- [ ] Regular security updates
- [ ] Encrypt environment variables
- [ ] Use secrets management (Vault/AWS Secrets)
- [ ] Enable audit logging
- [ ] Regular penetration testing

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026  
**Maintained By:** DevOps Team
