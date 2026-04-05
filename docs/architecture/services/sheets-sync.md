# Service: Sheets Sync (Data Connector)

## Overview
The `sheets-sync` service is a Python-based worker responsible for integrating with Google Sheets. It allows for importing call data and exporting analysis results in a tabular format.

---

## Responsibilities
- **Periodic Sync**: Fetches new call records from configured Google Sheets.
- **Data Push**: Exports analysis reports (Overall Rating, KPI, Brief) to external spreadsheets.
- **Integration Management**: Manages OAuth credentials for Google API.

---

## Architecture Role
- **Layer**: Integration Layer.
- **Service Dependencies**:
  - Google Sheets API (External)
  - `main-api` (Consumes call records)
  - PostgreSQL (Integration config)

---

## Tenant-Aware Behavior
- **Context Injection**: Each sync job is executed for a specific `company_id`.
- **Config Isolation**: Uses the `credentials` and `config` stored in the `integrations_schema.integrations` table per tenant.
- **Data Isolation**: Ensures that data fetched from a tenant's sheet is only written to that tenant's call records.

---

## Inputs / Outputs

### Inputs
- **Google Sheets Data**: Call metadata (Duration, Manager, Phone).
- **Integration Config**: JSON credentials and spreadsheet IDs from PostgreSQL.

### Outputs
- **API Requests**: Authenticated calls to `main-api` to create call records.
- **Spreadsheet Updates**: New rows or cells in Google Sheets with AI insights.

---

## Suggested Improvements (Non-Breaking)
- **Bidirectional Real-time Sync**: Move from polling to Google Sheets Webhooks (if supported) for faster data ingestion.
- **Custom Mapping**: Allow tenants to define custom column mapping between their sheets and the SalesAI schema.
