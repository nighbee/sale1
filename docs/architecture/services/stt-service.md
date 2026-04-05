# Service: STT Service (Transcription Engine)

## Overview
The `stt-service` is a Python-based worker responsible for converting speech to text (STT). It handles audio downloading, format conversion, speaker diarization, and transcription.

---

## Responsibilities
- **Audio Retrieval**: Downloads call recordings from Sipuni or MinIO.
- **Conversion**: Resamples audio to 16kHz mono WAV for optimal STT accuracy.
- **Diarization**: Distinguishes speakers (Speaker 0 vs. Speaker 1) using Pyannote or provider-native features.
- **Transcription**: Runs transcription via local (WhisperX) or cloud (OpenAI, ElevenLabs, Gemini, Soniox) providers.
- **Data Persistence**: Saves formatted transcripts to the PostgreSQL database.

---

## Architecture Role
- **Layer**: AI Pipeline (Async Worker).
- **Service Dependencies**:
  - PostgreSQL (Transcript storage)
  - BullMQ (Redis)
  - External STT Providers (OpenAI, ElevenLabs, Soniox, etc.)

---

## Tenant-Aware Behavior
- **Job Payload Context**: Receives the `company_id` as part of the BullMQ job payload.
- **Dynamic Provider Selection**: Loads the tenant's preferred STT provider and API keys from the `auth_schema.companies` table.
- **Circuit Breaker**: Implements a per-provider circuit breaker to prevent system-wide failures due to tenant-specific API key issues.

---

## Internal Modules (Logical)
- **Adapters**:
  - `queue`: BullMQ consumer.
  - `stt`: Provider-specific adapters (OpenAI, Deepgram, ElevenLabs, etc.).
- **Core Use Cases**: `ProcessAudioUseCase` orchestrates the entire STT pipeline.
- **Infrastructure**: Monitoring, circuit breakers, and audio conversion utilities.

---

## Inputs / Outputs

### Inputs
- **BullMQ Jobs**: JSON containing `call_id`, `company_id`, and `audio_url`.
- **Audio Files**: Raw recordings from telephony/storage.

### Outputs
- **Transcript Records**: Updates `calls_schema.transcripts` table.
- **Events**: Publishes `transcript_ready` events for the AI Analytics service.

---

## Suggested Improvements (Non-Breaking)
- **Unified Provider Interface**: Standardize the `STTProvider` port to simplify adding new providers with direct URL transcription support.
- **Async Streaming**: Move from batch processing to streaming for long calls to reduce initial latency.
