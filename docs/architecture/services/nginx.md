# Service: Nginx Gateway

## Overview
Nginx serves as the edge gateway and reverse proxy for the SalesAI platform. It is the entry point for all client-side and external webhook traffic.

---

## Responsibilities
- **Reverse Proxying**: Routes traffic to appropriate internal services (`main-api`, `frontend`).
- **SSL Termination**: Handles HTTPS for secure communication.
- **Request Buffering**: Protects internal services from slow clients.
- **Security**: Basic rate limiting and IP filtering.

---

## Service Boundaries

### Inputs
- **Public Traffic**: User requests to the web application.
- **API Requests**: REST calls from the frontend to `main-api`.
- **External Webhooks**: Incoming events from telephony providers (e.g., Sipuni).

### Outputs
- **Internal Routing**:
  - `main-api`: Orchestration and data CRUD.
  - `frontend`: Serves static assets and the single-page application.

---

## Multi-Tenancy Behavior
Nginx is **tenant-neutral** but provides the infrastructure for tenant resolution.
- Passes the `Host` header and client IP to downstream services.
- Ensures that the `Authorization` (JWT) bearer token is forwarded to `main-api`.

---

## Architecture Role
- **Layer**: Edge Layer (DMZ).
- **Service Dependency**: None (Internal services depend on it for external visibility).

---

## Suggested Improvements (Non-Breaking)
- **Tenant-based Routing (Experimental)**: Ability to route specific tenants to dedicated clusters based on subdomain (e.g., `company1.salesai.com`).
- **Enhanced Monitoring**: Integrate with Prometheus via `nginx_exporter` to track request rates per tenant (using header analysis).
