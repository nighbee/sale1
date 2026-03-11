# Sipuni Listener Service

The **Sipuni Listener Service** is responsible for real-time ingestion of call events from the Sipuni telephony platform. It maintains a persistent connection to Sipuni and initiates the call processing pipeline.

## Overview

- **Language**: Go 1.22+
- **Protocol**: WebSocket (Client to `wss://wss.sipuni.com/api`)
- **Queue**: BullMQ (Redis-backed) for asynchronous processing
- **Primary Database**: PostgreSQL

## Responsibilities

1. **Persistent Connection**: Maintains a long-lived WebSocket connection to Sipuni with 30-second keepalive intervals.
2. **Event Parsing**: Receives and parses `notify` events containing call metadata (timestamps, manager ID, client phone, and recording link).
3. **Record Creation**: Creates initial call records in the `calls_schema.calls` table with a `pending` status.
4. **Job Dispatch**: Enqueues `audio_processing` jobs into Redis for consumption by the STT Service.

## Folder Structure

### `cmd/listener/`
- Contains `main.go`, which implements the WebSocket lifecycle:
  - Connection management and exponential backoff retries.
  - Authentication with the Sipuni API key.
  - Keepalive heartbeats.
  - Event routing (`handleNotify`).

### `internal/adapters/`
- **`repositories/`**: Handles database persistence for new call records.
- **`queue/`**: Implements the BullMQ publisher to push jobs to Redis.

### `internal/core/`
- **`domain/`**: Defines the `Call` entity and status constants.

## Event Processing Flow

1. **Connect**: Establish WebSocket connection to Sipuni.
2. **Auth**: Send JSON auth message with the API key.
3. **Listen**: Wait for `action: notify` events.
4. **Validate**: Check if the call was answered (`ANSWER`) and has a recording link.
5. **Persist**: Generate a UUID and save the call metadata to PostgreSQL.
6. **Enqueue**: Push a job containing the `call_id` and `audio_url` to the `audio_processing` queue.
