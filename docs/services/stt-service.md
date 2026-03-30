# STT Service (Speech-to-Text)

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The STT (Speech-to-Text) Service is responsible for converting call audio recordings into text transcripts. It consumes audio processing jobs from BullMQ, performs speaker diarization, runs speech recognition using configurable providers (OpenAI Whisper, Google Gemini, or local WhisperX), and publishes transcript-ready events for downstream processing.

### 1.1 Purpose

- **Job Consumption**: Process audio jobs from BullMQ queue
- **Audio Download**: Fetch audio files from external URLs
- **Audio Conversion**: Convert audio to 16kHz WAV format
- **Speaker Diarization**: Identify different speakers using Pyannote
- **Speech Recognition**: Transcribe audio using configured STT provider
- **Transcript Storage**: Save transcripts to PostgreSQL
- **Event Publishing**: Notify AI Analytics when transcript is ready

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.11 |
| Framework | FastAPI | 0.109 |
| Database | PostgreSQL | 16 |
| Queue | BullMQ (Redis) | 7.2 |
| STT (OpenAI) | Whisper API | - |
| STT (Google) | Gemini STT | - |
| STT (ElevenLabs) | Scribe API | - |
| STT (Local) | WhisperX | - |
| Diarization | Pyannote / ElevenLabs | 3.x / Scribe |
| Audio Processing | pydub | 0.25 |
| Monitoring | Prometheus | - |
| Logging | Python logging | - |

### 1.3 Service Location

- **Internal Port**: 5001 (gRPC)
- **Metrics Port**: 8001
- **Protocol**: gRPC Server + BullMQ Consumer

---

## 2. Architecture

The STT Service follows **Clean Architecture** principles:

```
services/stt-service/
├── main.py                        # Entry point
├── src/
│   ├── adapters/
│   │   ├── queue/                # BullMQ consumer
│   │   ├── storage/              # MinIO, PostgreSQL clients
│   │   ├── events/               # Redis publisher
│   │   └── stt/                  # Provider implementations
│   ├── core/
│   │   ├── domain/               # Transcript, Audio entities
│   │   ├── ports/                # STT, Diarization interfaces
│   │   └── usecases/             # Audio processing logic
│   ├── infrastructure/
│   │   ├── stt/                  # WhisperX, OpenAI, Gemini
│   │   ├── diarization/          # Pyannote implementation
│   │   ├── audio/                # Audio converter (16kHz WAV)
│   │   └── grpc/                 # gRPC server
│   └── config/                   # Settings
├── requirements.txt
└── Dockerfile
```

### 2.1 Component Responsibilities

#### Main (main.py)
- Initializes logging
- Starts Prometheus metrics server
- Starts gRPC server
- Initializes BullMQ consumer

#### Adapters
- **Queue**: Consume audio processing jobs from BullMQ
- **Storage**: PostgreSQL and MinIO clients
- **Events**: Publish transcript_ready events to Redis
- **STT**: Provider-specific implementations

#### Core
- **Domain**: Transcript entity with speakers, segments
- **Ports**: Abstract interfaces for STT and diarization
- **Usecases**: Audio processing orchestration

#### Infrastructure
- **STT**: Provider implementations (OpenAI, Gemini, WhisperX)
- **Diarization**: Pyannote speaker diarization
- **Audio**: Audio format conversion
- **gRPC**: gRPC server for synchronous requests

---

## 3. Communication Patterns

### 3.1 Queue Consumption

```
BullMQ (Redis) ──Consume Job──→ STT Service
```

### 3.2 Database Access

```
STT Service ──Save Transcript──→ PostgreSQL
```

### 3.3 Event Publishing

```
STT Service ──Publish──→ Redis Stream (transcript_ready)
```

### 3.4 Complete Data Flow

```
┌─────────────────┐
│  BullMQ Queue   │
│  (audio_processing)
└────────┬────────┘
         │ Consume Job
         ▼
┌─────────────────┐
│  STT Service    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ MinIO │ │ HTTP  │
│(File) │ │(Audio)│
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  Audio Converter│
│  (16kHz WAV)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pyannote       │
│  (Diarization)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  STT Provider   │
│  (Whisper/Gemini│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (Save Transcript)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redis Stream  │
│  (transcript_ready)
└─────────────────┘
```

---

## 4. Processing Flow

### 4.1 Job Processing Pipeline

1. **Receive Job**: Consume from BullMQ `audio_processing` queue
2. **Fetch Settings**: Get company STT preferences from database
3. **Download Audio**: Fetch audio from URL to `/tmp`
4. **Convert Audio**: Transform to 16kHz WAV using pydub
5. **Diarize**: Run Pyannote speaker diarization
6. **Transcribe**: Run STT using configured provider
7. **Merge Results**: Combine diarization with transcript
8. **Save**: Store transcript JSON in PostgreSQL
9. **Cleanup**: Delete temporary audio files
10. **Publish**: Emit `transcript_ready` event to Redis Stream

### 4.2 Input Job Format

```
json
{
  "job_type": "audio_processing",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "audio_url": "https://files.sipuni.com/.../record.mp3",
  "manager_id": "manager-123",
  "retry_count": 0,
  "max_retries": 3
}
```

### 4.3 Transcript Output Format

```
json
{
  "call_id": "uuid-generated",
  "content": [
    {
      "start": 0.0,
      "end": 5.5,
      "speaker": "SPEAKER_00",
      "text": "Hello, how can I help you today?"
    },
    {
      "start": 5.5,
      "end": 12.0,
      "speaker": "SPEAKER_01",
      "text": "I'm interested in your product..."
    }
  ],
  "speakers": {
    "SPEAKER_00": "manager",
    "SPEAKER_01": "client"
  },
  "language": "en",
  "duration": 3600.0
}
```

---

## 5. STT Providers

### 5.1 OpenAI Whisper

- **Provider**: OpenAI Whisper API
- **Model**: `whisper-1`
- **Configuration**: `STT_PROVIDER=openai`
- **API Key**: `OPENAI_API_KEY`

### 5.2 Google Gemini STT

- **Provider**: Google Gemini
- **Model**: Configurable via `GOOGLE_AI_MODEL`
- **Configuration**: `STT_PROVIDER=gemini`
- **API Key**: `GOOGLE_API_KEY`

### 5.3 Google Cloud Speech

- **Provider**: Google Cloud Speech-to-Text
- **Model**: Configurable via `GOOGLE_CLOUD_SPEECH_MODEL`
- **Configuration**: `STT_PROVIDER=google_cloud`
- **API Key**: `GOOGLE_APPLICATION_CREDENTIALS`

### 5.4 Groq STT

- **Provider**: Groq (OpenAI-compatible API)
- **Model**: `whisper-large-v3-turbo` (default)
- **Configuration**: `STT_PROVIDER=groq`
- **API Key**: `GROQ_API_KEY`
- **Advantage**: Fast inference, competitive pricing, OpenAI-compatible SDK

### 5.5 Deepgram STT

- **Provider**: Deepgram
- **Model**: `nova-2` (default)
- **Configuration**: `STT_PROVIDER=deepgram`
- **API Key**: `DEEPGRAM_API_KEY`
- **Model Config**: `DEEPGRAM_MODEL` (optional)
- **Advantage**: Fast, accurate, excellent for Russian language

### 5.6 Local WhisperX

- **Provider**: Local WhisperX
- **Model**: `base`, `small`, `medium`, `large`
- **Configuration**: `STT_PROVIDER=local`
- **Advantage**: No API costs, runs locally

### 5.7 ElevenLabs Scribe

- **Provider**: ElevenLabs
- **Model**: `scribe_v1`
- **Configuration**: `STT_PROVIDER=elevenlabs`
- **API Key**: `ELEVENLABS_API_KEY`
- **Advantage**: Superior quality for Russian language, built-in high-quality speaker diarization.
- **Optimization**: Automatically skips local Pyannote processing when used.

---

## 6. gRPC API

The STT Service exposes a gRPC interface for synchronous requests.

### 6.1 Service Definition

See `proto/stt_service.proto`:

```
proto
service STTService {
  rpc Transcribe(TranscribeRequest) returns (TranscribeResponse);
  rpc GetTranscript(GetTranscriptRequest) returns (GetTranscriptResponse);
}
```

### 6.2 Transcribe Request

```
proto
message TranscribeRequest {
  string call_id = 1;
  string audio_url = 2;
  string company_id = 3;
  string provider = 4;  // "openai", "gemini", "local"
}
```

### 6.3 Transcribe Response

```
proto
message TranscribeResponse {
  string call_id = 1;
  Transcript transcript = 2;
  bool success = 3;
  string error = 4;
}
```

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | redis://redis:6379 |
| `STT_PROVIDER` | STT provider: openai, gemini, google_cloud, groq, deepgram, local | openai |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GOOGLE_API_KEY` | Google API key | - |
| `GOOGLE_AI_MODEL` | Google STT model name | - |
| `GOOGLE_CLOUD_SPEECH_MODEL` | Google Cloud Speech model name | - |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud credentials path | - |
| `GROQ_API_KEY` | Groq API key | - |
| `GROQ_STT_MODEL` | Groq Whisper model | whisper-large-v3-turbo |
| `DEEPGRAM_API_KEY` | Deepgram API key | - |
| `DEEPGRAM_MODEL` | Deepgram model | nova-2 |
| `WHISPER_MODEL` | WhisperX model size | base |
| `METRICS_PORT` | Prometheus metrics port | 8001 |

### 7.2 Docker Configuration

```
yaml
stt-service:
  build: ./services/stt-service
  environment:
    DATABASE_URL: "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable"
    REDIS_URL: "redis://redis:6379"
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    GOOGLE_API_KEY: ${GOOGLE_API_KEY}
    GOOGLE_AI_MODEL: ${GOOGLE_AI_MODEL}
    STT_PROVIDER: "openai"
  depends_on:
    - postgres
    - redis
```

---

## 8. Database Schema

### 8.1 Transcripts Table

```
sql
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID UNIQUE NOT NULL,
    content JSONB NOT NULL,
    speakers JSONB,
    language VARCHAR(10),
    duration FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcripts_call_id ON transcripts(call_id);
```

---

## 9. Redis Events

### 9.1 Transcript Ready Event

Published to Redis Stream `transcript_ready`:

```
json
{
  "event_type": "transcript_ready",
  "call_id": "uuid-generated",
  "company_id": "company-uuid",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

---

## 10. Speaker Diarization

### 10.1 Pyannote

The service uses Pyannote for speaker diarization:
- Identifies number of speakers
- Assigns speaker labels to transcript segments
- Outputs timestamps for each speaker turn

### 10.2 Speaker Labels

- `SPEAKER_00`: Typically the manager/agent
- `SPEAKER_01`: Typically the customer/client

---

## 11. Error Handling

### 11.1 Job Errors

- **Download Failed**: Retry with exponential backoff
- **Conversion Failed**: Log error, mark job as failed
- **Transcription Failed**: Retry up to max_retries
- **Database Error**: Log error, skip saving

### 11.2 Error Recovery

- Jobs can be retried up to configured max_retries
- Failed jobs are marked in BullMQ
- Manual retry possible via BullMQ dashboard

---

## 12. Monitoring

### 12.1 Metrics

Prometheus metrics exposed at `/metrics`:

- `stt_requests_total` - Total transcription requests
- `stt_request_duration_seconds` - Request latency
- `stt_requests_failed_total` - Failed requests
- `stt_audio_duration_seconds` - Processed audio duration

### 12.2 Logging

JSON structured logging:

```
json
{
  "level": "info",
  "ts": "2026-02-01T12:00:00.000Z",
  "msg": "Audio processing completed",
  "call_id": "uuid",
  "duration": 3600.0
}
```

---

## 13. Dependencies

### 13.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| PostgreSQL | Direct | Store transcripts |
| BullMQ/Redis | Direct | Job queue |
| AI Analytics | Redis Stream | Notify when ready |

### 13.2 External Services

| Service | Integration | Purpose |
|---------|------------|---------|
| OpenAI | API | Whisper transcription |
| Google | API | Gemini transcription, Cloud Speech |
| Groq | API | Fast Whisper transcription |
| Deepgram | API | Fast transcription with excellent Russian support |
| Sipuni | HTTP | Download audio files |

---

## 14. Integration with Other Services

### 14.1 Sipuni Listener

- Receives job from BullMQ
- Processes audio from call recordings

### 14.2 AI Analytics

- Consumes `transcript_ready` events
- Fetches transcript from PostgreSQL
- Performs analysis

### 14.3 Main API

- Can request transcription via gRPC
- Reads transcripts for display

---

## 15. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [Sipuni Listener Documentation](./sipuni-listener.md)
- [AI Analytics Documentation](./ai-analytics.md)
- [Main API Documentation](./main-api.md)
- [gRPC Contract](../../proto/stt_service.proto)
- [Deployment Guide](../deployment.md)
