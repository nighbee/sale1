-- Migration 023: Add 'elevenlabs' to transcripts stt_provider check constraint
ALTER TABLE calls_schema.transcripts
    DROP CONSTRAINT IF EXISTS transcripts_stt_provider_check;

ALTER TABLE calls_schema.transcripts
    ADD CONSTRAINT transcripts_stt_provider_check
        CHECK (stt_provider IN ('whisperx_local', 'openai', 'gemini', 'groq', 'deepgram', 'elevenlabs'));
