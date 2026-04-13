# Queue Management Architecture

The Queue Management feature allows Tenant Admins to manage their sales call analysis pipeline.

## Backend Components

### Domain & Ports
- `CallRepository`: Added `UpdateStatusByFilter` to allow bulk status updates (e.g., re-queueing or cancelling).
- `QueuePublisher`: Added tenant-scoped management methods: `PauseQueue`, `ResumeQueue`, `GetQueueItems`, and `DeleteQueueItem`.

### Use Cases
- `BulkReprocessUseCase`: Handles date-range based re-queueing of calls.
- `ClearTenantQueueUseCase`: Cancels pending calls and removes them from the Redis queue.

### Handlers
- `QueueHandler`: Exposes REST endpoints for the above functionalities, ensuring tenant isolation by using `company_id` from JWT context.

## Queue Flow
1. **Reprocess**: Status set to `pending` in PostgreSQL -> Job added to Redis `bullmq:audio_processing`.
2. **Clear**: Status set to `error` in PostgreSQL -> Jobs removed from Redis list.
3. **Stop**: Queue for the tenant is paused via a Redis flag, and existing items are cleared.

## API Endpoints
- `GET /api/v1/calls/queue/status`: Get current queue length and pause status.
- `POST /api/v1/calls/queue/bulk-reprocess`: Re-enqueue calls for a specific date range.
- `DELETE /api/v1/calls/queue`: Clear all pending tasks.
- `POST /api/v1/calls/queue/stop`: Pause processing and clear current queue.
- `POST /api/v1/calls/queue/resume`: Resume processing.
- `GET /api/v1/calls/queue/items`: List specific jobs in the queue.
- `DELETE /api/v1/calls/queue/items`: Remove a specific job.
