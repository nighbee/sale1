# ElevenLabs Scribe Pivot Plan

This document outlines the steps required to pivot the STT engine to ElevenLabs Scribe.

## 1. Infrastructure & Environment
- [x] Add `ELEVENLABS_API_KEY` to root `.env` file.
- [ ] Add `ELEVENLABS_API_KEY` to `docker-compose.yml` environment for `stt-service`.
- [ ] Update `services/stt-service/src/config/settings.py` (if exists) to include ElevenLabs configuration.

## 2. Dependencies
- [ ] Add `elevenlabs` to `services/stt-service/requirements.txt`.
- [ ] Run `pip install elevenlabs` in the development environment.

## 3. Database (Main API)
- [ ] Create a new migration in `services/main-api/internal/infrastructure/database/migrations/` to update the `stt_provider` check constraint.
    - Path: `023_add_elevenlabs_stt_provider.sql`
    - Content: `ALTER TABLE calls_schema.transcripts DROP CONSTRAINT transcripts_stt_provider_check; ALTER TABLE calls_schema.transcripts ADD CONSTRAINT transcripts_stt_provider_check CHECK (stt_provider IN ('whisperx_local', 'openai', 'gemini', 'groq', 'deepgram', 'elevenlabs'));`
- [ ] Apply the migration.

## 4. STT Service Implementation
- [ ] Create `services/stt-service/src/adapters/stt/elevenlabs_provider.py`.
    - Implement `ElevenLabsSTTProvider` class inheriting from `STTProvider`.
    - Use ElevenLabs Scribe API for transcription.
    - Map ElevenLabs output format (segments with speaker IDs) to the internal `Transcript` domain model.
- [ ] Update `services/stt-service/src/adapters/stt/factory.py`.
    - Add `elif provider_name == "elevenlabs":` to the `create` method.
- [ ] Optimize `ProcessAudioUseCase` in `services/stt-service/src/core/usecases/process_audio.py`.
    - ElevenLabs Scribe provides high-quality diarization. 
    - Consider allowing the STT provider to return "is_diarized" flag to skip local `Pyannote` processing if possible, reducing CPU/Memory usage.

## 5. AI Analytics Integration
- [ ] Verify that ElevenLabs transcripts work seamlessly with the current LLM analytics prompts.
- [ ] Scribe's superior quality in Russian should improve the "Script Match" and "Quality Score" accuracy.

## 6. Testing & Validation
- [ ] Create a smoke test script for `ElevenLabsSTTProvider`.
- [ ] Verify handling of various audio formats supported by Sipuni.
- [ ] Validate speaker labels consistency.

## 7. Documentation
- [ ] Update `docs/services/stt-service.md` to include ElevenLabs as a provider option.
- [ ] Update PRD if necessary.
