# Main API Service

The **Main API Service** is the central hub of the SalesAI ecosystem. It provides the primary entry point for the frontend and external clients, orchestrating authentication, data management, and analytics.

## Overview

- **Language**: Go 1.22+
- **Framework**: [Fiber v2](https://gofiber.io/)
- **Architecture**: Clean Architecture (Hexagonal Architecture)
- **Primary Database**: PostgreSQL
- **Real-time**: WebSockets (custom hub implementation)
- **Communication**: gRPC (Client to STT and AI Analytics services), Redis (Events and Caching)

## Folder Structure

The service follows Clean Architecture principles to ensure separation of concerns and maintainability:

### `cmd/api/`
- Contains the main entry point (`main.go`) that initializes the application, connects to infrastructure, and starts the HTTP server.

### `internal/adapters/`
- **`http/`**: Handles incoming HTTP requests. Contains:
  - `handlers/`: Controllers that parse requests and call use cases.
  - `middleware/`: Standard middlewares for JWT, RBAC, logging, and request tracing.
  - `routes.go`: Central route definitions.
  - `ws/`: WebSocket hub and client management.
- **`grpc/`**: gRPC client implementations for communicating with Python services (STT and AI Analytics).
- **`repositories/`**: Concrete implementations of data access ports using PostgreSQL.
- **`events/`**: Redis-based event consumers and publishers (e.g., notification processing).

### `internal/core/`
- **`domain/`**: Enterprise business entities (e.g., `User`, `Call`, `Company`, `AnalysisReport`). These are pure Go structs with no external dependencies.
- **`ports/`**: Interface definitions for repositories and services. This layer defines the contracts that adapters must implement (Dependency Inversion).
- **`usecases/`**: Pure business logic. Each use case represents a specific application feature (e.g., `Login`, `ListCalls`, `GetTeamPerformance`).

### `internal/infrastructure/`
- **`config/`**: Environment-based configuration management using Viper.
- **`database/`**: Database connection management and automatic migrations.
- **`logger/`**: Structured logging setup using Zap.
- **`security/`**: JWT generation/validation and password hashing.

### `pkg/`
- Shared packages and helper functions that can be used across the service or exported.
- **`stt/`** & **`analytics/`**: Generated gRPC code from proto definitions.

## Key Features

1. **Multi-tenant Auth**: JWT-based authentication with role-based access control (RBAC).
2. **Call Analytics**: Aggregated performance metrics and leaderboards.
3. **Integration Management**: Handling configurations for Sipuni, Google Sheets, etc.
4. **Real-time Notifications**: Notifying users via WebSockets when call analysis is completed.
