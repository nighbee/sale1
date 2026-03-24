# SalesAI Monitoring System

The SalesAI platform uses a modern observability stack consisting of Prometheus, Grafana, Loki, and Promtail to provide real-time metrics and centralized logging across all microservices.

## Architecture

- **Prometheus**: Collects and stores time-series metrics from all services via their `/metrics` endpoints.
- **Loki**: A log aggregation system inspired by Prometheus. It stores logs from all Docker containers.
- **Promtail**: An agent that ships local logs to Loki. It is configured to discover Docker container logs and extract service/level labels from our structured JSON logs.
- **Grafana**: The visualization layer. It provides dashboards for metrics (via Prometheus) and log exploration (via Loki).

## Accessing Dashboards

By default, Grafana is available at:
- **URL**: `http://localhost:3000`
- **Default Credentials**: `admin` / `admin` (can be changed in `docker-compose.yml`)

### Pre-configured Dashboards

1. **Service Metrics**: Displays CPU, Memory, Request Latency, and Error Rates for Go and Python services.
2. **Log Explorer**: Centralized view of all service logs with filtering by `service`, `level`, and `correlation_id`.

## Centralized Logging

All services emit logs in structured JSON format. A typical log entry includes:
- `timestamp`: RFC3339/ISO8601 formatted time.
- `level`: Log level (debug, info, warn, error).
- `service`: The name of the microservice (e.g., `main-api`, `stt-service`).
- `message`: The log message.
- `correlation_id`: (Optional) Distributed tracing ID to follow a request across services.

### Querying Logs in Grafana (Loki)

Use LogQL to filter logs. Example queries:
- View all error logs: `{job="docker"} | json | level="error"`
- View logs for a specific service: `{service="main-api"}`
- Search for a specific Call ID: `{job="docker"} |= "call_id_123"`

## Service Metrics

Each service exposes metrics on a dedicated port:
- `main-api`: `8080/metrics`
- `sipuni-listener`: `8081/metrics`
- `script-service`: `8083/metrics`
- `stt-service`: `8001/metrics`
- `ai-analytics`: `8001/metrics`
- `sheets-sync`: `8085/metrics`

Prometheus automatically scrapes these targets every 15 seconds.

## Infrastructure Monitoring

- **cAdvisor**: Monitors Docker container resource usage (CPU, Memory, Network, Disk).
- **Redis Exporter**: Provides metrics for the Redis instance used by BullMQ and notification events.
- **BullMQ Exporter**: Monitors job queue status (completed, failed, waiting, delayed).
