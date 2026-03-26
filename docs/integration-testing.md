# Integration Testing Architecture

This document describes how SalesAI validates third-party integrations (Sipuni, OpenAI, Google Sheets, etc.) in the `main-api` service.

## Overview

The `IntegrationUseCase.TestConnection` method in `services/main-api/internal/core/usecases/integrations/integration_usecase.go` is responsible for verifying that the provided credentials and configuration for an integration are valid before saving them.

## Validation Strategies

### 1. Telephony (Sipuni)
- **Method**: Real WebSocket handshake.
- **Details**: Establishes a connection to `wss://wss.sipuni.com/api` and sends an `auth` message with the API key. It waits for an `auth` action response with `status: 1`.
- **Reasoning**: This ensures the API key is active and authorized to receive call events.

### 2. AI Providers (OpenAI, Groq, Deepgram, Gemini)
- **Method**: Authenticated API request to a "list models" or "projects" endpoint.
- **Details**:
  - **OpenAI/Groq**: GET `/v1/models` with `Bearer` token.
  - **Deepgram**: GET `/v1/projects` with `Token` header.
  - **Gemini**: GET `/v1beta/models` with `key` query parameter.
- **Reasoning**: Verifies that the API key is valid and has sufficient permissions to use the provider's services.

### 3. Google Sheets
- **Method**: Metadata retrieval via Google Sheets API.
- **Details**: Uses the provided Service Account JSON to authenticate a JWT client and attempts to fetch spreadsheet metadata for the given `spreadsheet_id`.
- **Reasoning**: Confirms that the service account has at least read access to the specific spreadsheet.

### 4. Messaging (Telegram, Slack)
- **Method**: Reachability and basic API call.
- **Details**:
  - **Telegram**: GET `/bot{token}/getMe` to verify the bot token.
  - **Slack**: Sends a "Connection Test" message to the provided `webhook_url`.
- **Reasoning**: Ensures the bot/webhook is correctly configured and reachable.

### 5. CRM (AmoCRM)
- **Method**: Basic reachability check.
- **Details**: Attempts to GET the `/api/v4/account` endpoint on the provided subdomain. An `Unauthorized (401)` response is considered a success for the subdomain check if no token is available yet.

## Frontend Integration

The frontend `IntegrationModal` component in `services/frontend/src/features/integrations/ui/IntegrationModal.tsx` handles the "Test Connection" button. It displays:
- A loading spinner while the test is in progress.
- A success/error message returned from the backend.
- A toast notification with the specific error if the test fails.

## Adding New Integrations

1. Add the new `IntegrationType` in `domain/integration.go`.
2. Implement a `test{Provider}` method in `IntegrationUseCase`.
3. Update the `TestConnection` switch statement to use the new method.
4. (Optional) Add unit tests in `integration_usecase_test.go`.
5. Update the `IntegrationModal.tsx` in the frontend to include fields for the new integration type.
