# Service: AI Analytics (Intelligence Engine)

## Overview
The `ai-analytics` service is a Python-based worker responsible for generating high-level insights from call transcripts. It evaluates call quality, script adherence, and provides coaching tips.

---

## Responsibilities
- **LLM-based Analysis**: Runs sophisticated prompts via Large Language Models (LLM) to score calls (0-100).
- **Metric Calculation**: Computes Overall Rating and KPI based on Quality Score, Script Match, and Errors.
- **Actionable Insights**: Generates "Brief" summaries and "Next Best Action" recommendations.
- **CRM Write-back**: (Optional) Pushes analysis results back to external CRMs like AmoCRM.

---

## Architecture Role
- **Layer**: AI Pipeline (Async Worker).
- **Service Dependencies**:
  - PostgreSQL (Transcript and analysis storage)
  - Redis Streams (Consumes `transcript_ready` events)
  - LLM Providers (OpenAI, Gemini)

---

## Tenant-Aware Behavior
- **Tenant Context**: Inherits `company_id` from the `transcript_ready` event.
- **Script Customization**: Fetches the company's "Golden Script" from the `scripts_schema.scripts` table for evaluation.
- **Prompt Engineering**: Applies tenant-specific scoring rubrics and persona instructions.

---

## Internal Modules (Logical)
- **Adapters**:
  - `events`: Redis Stream consumer.
  - `llm`: Provider-specific adapters (OpenAI, Gemini).
- **Core Use Cases**: `AnalyzeCallUseCase` handles the analysis flow and KPI computation.
- **Infrastructure**: Prompts, scoring rubrics, and CRM clients.

---

## Inputs / Outputs

### Inputs
- **Redis Stream Events**: Notification of ready transcripts.
- **Transcript Data**: Fetched from `calls_schema.transcripts`.
- **Golden Scripts**: Fetched from `scripts_schema.scripts`.

### Outputs
- **Analysis Reports**: Updates `calls_schema.analysis_reports` table.
- **Call Status**: Updates the `calls_schema.calls` table to `completed`.

---

## Suggested Improvements (Non-Breaking)
- **Prompt Versioning**: Maintain different versions of LLM prompts per tenant to allow for iterative improvements without breaking existing reports.
- **Token Tracking**: Track LLM token usage per tenant for billing and quota management.
