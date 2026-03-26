# Frontend Architecture Documentation (FSD)

This document describes the implementation of the Sales Script and Integration Management features following Feature-Sliced Design (FSD) principles.

## 1. Script Management

### Entities (`entities/script`)
- **Model:** Centralizes the state and logic for scripts.
  - `useScripts` hook: Manages fetching, uploading, renaming, and deleting user scripts. It handles API interactions and provides loading/error states.
  - `useBaseScripts` hook: Specifically manages "Base Scripts" (global templates), including activation logic.
- **API:** `scriptApi` defines the axios-based communication with the backend.
  - Consolidates requests through `main-api` instead of direct `script-service` calls to ensure proper metadata handling.
- **Types:** Defines the `Script` interface used across the application.

### Pages (`pages/ScriptsList.tsx`)
- Orchestrates the UI for listing and managing scripts.
- Uses `useScripts` and `useBaseScripts` hooks to decouple business logic from the view.
- Implements search, upload (via hidden file input), rename (via prompt), and delete (with confirmation).

## 2. Integration Management

### Entities (`entities/integration`)
- **Model:**
  - `useIntegrationStore`: A Zustand store for global integration state.
- **API:** `integrationApi` includes methods for CRUD operations and the new `test` method.
- **Types:** `Integration` interface was extended to include `last_checked_at` and `status_message` for better visibility of connection health.

### Features (`features/integrations`)
- **UI:** `IntegrationModal.tsx`
  - A complex component that handles dynamic field rendering based on integration type (e.g., API keys for AI, OAuth-like config for Google Sheets).
  - **New Feature:** "Test Connection" button. It allows users to verify credentials *before* saving, providing immediate feedback via `testResult` state.

### Pages (`pages/Integrations/ui/IntegrationsPage.tsx`)
- Displays all connected and available integrations.
- **Enhanced UI:**
  - Shows connectivity status via color-coded indicators (Green for OK, Red for Error).
  - Displays the last successful check time.
  - Provides a quick way to re-configure or disconnect.

## 3. Implementation Details (Cross-Service)

### Backend Consolidation
To solve the production issue where the scripts page failed due to direct routing to `script-service`, we:
1.  Removed direct Nginx routing to `script-service` for `/api/v1/scripts`.
2.  Routed all requests through `main-api`.
3.  `main-api` acts as an orchestrator, proxying file-intensive tasks (upload/download/physical delete) to `script-service` while maintaining the master record in the central database.

### API Response Standardization
Standardized the response format for script lists to always return an object `{ scripts: [...] }` or `{ base_scripts: [...] }` to match FSD entity expectations and avoid runtime errors when the backend returns raw arrays.
