# Google Sheets Sync Service

The **Sheets Sync Service** facilitates bidirectional data synchronization between Google Sheets and the SalesAI database. It allows companies to use Google Sheets as a data source for calls and as a destination for analysis results.

## Overview

- **Language**: Python 3.11
- **Integrations**: Google Sheets API v4
- **Operating Modes**: Scheduler (Cron-like) and HTTP API

## Features

1. **Ingestion**: Reads new rows from configured Google Sheets, creates call records in PostgreSQL, and enqueues them for STT processing.
2. **Write-back**: Updates Google Sheets with completed AI analysis results (scores, summaries, next steps).
3. **Manager Reconciliation**: Maps manager names from sheets to internal user IDs, creating placeholder users if necessary.
4. **State Management**: Tracks synchronization progress to avoid duplicate processing.

## Operation Modes

### Scheduler Mode (`RUN_MODE=scheduler`)
- The default mode. Runs a synchronization cycle periodically based on the `SYNC_INTERVAL` environment variable.

### API Mode (`RUN_MODE=api`)
- Exposes a FastAPI server that allows triggering sync cycles via HTTP POST requests.
- Endpoint: `POST /sync`

## Folder Structure

### `src/`
- **`sheets_client.py`**: Low-level wrapper for the Google Sheets API.
- **`pipeline.py`**: High-level orchestration of the ingest and write-back phases.
- **`db.py`**: PostgreSQL client for data persistence.
- **`queue_client.py`**: BullMQ publisher for triggering the processing pipeline.

## Ingestion Logic

The service looks for rows that have a valid "Call Link" but haven't been processed yet. It parses the date, time, and manager information, then pushes the data into the system as if it came from a telephony integration.
