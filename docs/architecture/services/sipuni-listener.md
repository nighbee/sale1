# Service: Sipuni Listener (Ingestion Gateway)

## Overview
The `sipuni-listener` is a Go service dedicated to ingesting telephony events from the Sipuni platform. It acts as a gateway for external call data.

---

## Responsibilities
- **Persistent Connection**: Maintains a WebSocket connection to `wss://wss.sipuni.com/api`.
- **Event Normalization**: Receives raw Sipuni events, parses call metadata (duration, manager, phone), and converts them into an internal format.
- **Job Orchestration**: For completed calls, creates a base record in PostgreSQL and pushes an `audio_processing` job to BullMQ.
- **Authentication**: Performs initial auth with Sipuni using the company's API key.

---

## Architecture Role
- **Layer**: Ingestion Layer / Edge Service.
- **Service Dependencies**:
  - Sipuni WebSocket API (External)
  - PostgreSQL (Metadata storage)
  - Redis (BullMQ queue)

---

## Tenant-Aware Behavior
- **API Key Resolution**: Resolves the `company_id` based on the Sipuni API Key used for the WebSocket connection.
- **Metadata Mapping**: Maps external `manager_id` (e.g., "222") to the internal `User` and `Company` based on the tenant's integration settings.

---

## Inputs / Outputs

### Inputs
- **WebSocket Events**: Inbound/outbound call notifications from Sipuni.
- **Webhooks**: (Alternative) HTTP callbacks from Sipuni for call status.

### Outputs
- **Database Records**: Updates `calls_schema.calls` table.
- **BullMQ Jobs**: Enqueues processing jobs for the AI pipeline.

---

## Suggested Improvements (Non-Breaking)
- **Deterministic ID Generation**: Use `uuid.NewMD5` based on Sipuni `CallID` for consistent record linking across services.
- **Enhanced Logging**: Track event latency (from Sipuni event to job enqueuing) per tenant to monitor ingestion performance.
