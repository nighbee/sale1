# AI Analytics Service

The **AI Analytics Service** is a Python-based microservice that uses Large Language Models (LLMs) to analyze call transcripts and evaluate sales performance.

## Overview

- **Language**: Python 3.11
- **Framework**: FastAPI (for gRPC/Health checks)
- **Event-Driven**: Consumes `transcript_ready` events from Redis
- **AI Engines**: Integration with OpenAI (GPT-4) and Google Gemini

## Responsibilities

1. **Analysis Triggering**: Consumes events indicating that a new transcript is ready for analysis.
2. **Context Retrieval**: Fetches the transcript, associated sales script, and call metadata from PostgreSQL.
3. **LLM Orchestration**: Sends the transcript and script to an LLM with a specialized system prompt for evaluation.
4. **Metrics Calculation**:
   - **Quality Score**: Overall professional assessment.
   - **Script Match**: Adherence to the defined sales script.
   - **Error Detection**: Identifying forbidden words or logical errors.
   - **KPI Computation**: Calculating a composite score based on quality and duration.
5. **Report Generation**: Saves the structured analysis (summary, objections, next steps, scores) to the `calls_schema.analysis_reports` table.

## Folder Structure

### `src/adapters/`
- **`events/`**: Implements the Redis consumer for the AI pipeline.
- **`storage/`**: PostgreSQL and MinIO clients.
- **`crm/`**: (Optional) Clients for writing analysis results back to CRMs like AmoCRM.

### `src/core/`
- **`domain/`**: Data models for Analysis Reports and Metrics.
- **`ports/`**: Interfaces for LLM providers.
- **`usecases/`**: Orchestration logic for the analysis workflow.

### `src/infrastructure/`
- **`llm/`**: Concrete implementations for OpenAI and Gemini clients.
- **`prompts/`**: System prompts, scoring rubrics, and templates used for LLM interaction.

## Analysis Logic

The service uses a "chain-of-thought" style prompt to ensure the LLM provides objective, actionable feedback. It evaluates the manager's performance against the specific phases and requirements defined in the company's sales script.
