# Service: Frontend (SalesAI Client)

## Overview
The SalesAI Frontend is a modern React single-page application (SPA). It provides the user interface for sales representatives and managers to interact with the platform.

---

## Responsibilities
- **Visualization**: Displays call metrics, heatmaps, and leaderboard.
- **Interactive Playback**: The "Karaoke" player for call transcripts with synchronized audio.
- **Script Management**: Provides the UI for creating and managing sales scripts.
- **Authentication**: Handles user login, registration, and JWT token storage.

---

## Service Boundaries

### Inputs
- **User Actions**: UI interactions.
- **Data**: REST API responses from `main-api`.
- **Media**: Audio streams from `/api/v1/calls/{id}/audio` (proxied through `main-api` or directly from external sources).

### Outputs
- **API Requests**: Authenticated HTTP requests with JWT tokens.
- **Telemetry**: (Optional) UI analytics and error logs (e.g., Sentry).

---

## Internal Modules (Logical)
- **Features**:
  - `auth`: JWT management and login/signup flows.
  - `calls`: List and detail views for call records.
  - `analytics`: Dashboard components and data visualization.
  - `integrations`: UI for connecting CRM and telephony.
  - `scripts`: Script builder and configuration.
- **Shared UI**: Custom `Select`, `Button`, `Modal`, and data-table components.

---

## Tenant-Aware Behavior
- **Context Injection**: The `tenant_id` is extracted from the JWT after login.
- **Data Filtering**: All requests to `main-api` implicitly include the tenant context via the JWT.
- **UI Customization**: Display company-specific branding (e.g., logo, company name) based on the current tenant.

---

## Architecture Role
- **Layer**: Client Layer.
- **Service Dependency**: `main-api`.

---

## Suggested Improvements (Non-Breaking)
- **State Management**: Utilize a robust state management library (e.g., TanStack Query) for efficient caching of tenant-specific data.
- **Modularization**: Further decouple the features using a Feature-Sliced Design (FSD) to improve maintainability in a multi-tenant environment.
