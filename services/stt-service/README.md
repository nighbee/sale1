# STT Service

The **STT Service** (Speech-to-Text) is a Python-based microservice that processes audio recordings to generate speaker-labeled transcripts.

## Overview

- **Language**: Python 3.11
- **Framework**: FastAPI (for gRPC/Health checks)
- **Queue**: BullMQ (Redis) consumer
- **Diarization**: Support for speaker separation
- **STT Engines**: Support for OpenAI Whisper, Google Gemini, and Deepgram

## Responsibilities

1. **Job Consumption**: Listens for `audio_processing` jobs from the BullMQ queue.
2. **Audio Pre-processing**: Downloads audio from external URLs and converts them to the required format (e.g., 16kHz WAV).
3. **Speaker Diarization**: Separates audio into segments based on who is speaking.
4. **Transcription**: Converts speech to text using the configured provider (OpenAI, Gemini, or Deepgram).
5. **Data Persistence**: Saves the resulting transcript segments to the `calls_schema.transcripts` table.
6. **Event Notification**: Publishes a `transcript_ready` event to Redis to trigger the next stage (AI Analytics).

## Folder Structure

### `src/adapters/`
- **`queue/`**: Implements the BullMQ consumer using the `redis` library.
- **`storage/`**: Contains database (PostgreSQL) and object storage (MinIO) clients.
- **`events/`**: Handles publishing events to Redis Streams or Pub/Sub.

### `src/core/`
- **`ports/`**: Defines abstract base classes (interfaces) for STT and Diarization providers.
- **`usecases/`**: Contains the core orchestration logic for processing a call from audio to transcript.

### `src/infrastructure/`
- **`stt/`**: Concrete implementations of transcription providers (OpenAI, Gemini, Deepgram).
- **`diarization/`**: Concrete implementation of speaker diarization.
- **`audio/`**: Utilities for audio conversion using `pydub` or `ffmpeg`.

## Configuration

The service is configured via environment variables, allowing selection of the primary STT engine and providing necessary API keys for cloud providers.
