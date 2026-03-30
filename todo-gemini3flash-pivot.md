# Gemini 3 Flash Preview Pivot Plan

This document outlines the steps required to pivot the AI Analytics module to use the Google Gemini API with the `gemini-3-flash-preview` model.

## 1. Infrastructure & Environment
- [x] Add `GEMINI_API_KEY` to root `.env` file.
- [ ] Add `GEMINI_API_KEY` to `docker-compose.yml` environment for `ai-analytics`.
- [ ] Update `LLM_PROVIDER` environment variable to `gemini` in `docker-compose.yml`.
- [ ] Update `LLM_MODEL` environment variable to `gemini-3-flash-preview` in `docker-compose.yml`.

## 2. Dependencies
- [ ] Ensure `google-generativeai` is in `services/ai-analytics/requirements.txt` (currently already used in stt-service, verify for analytics).
- [ ] Run `pip install google-generativeai` in the `ai-analytics` environment.

## 3. Implementation (AI Analytics)
- [ ] **LLM Client Update:**
    - The `GeminiClient` in `services/ai-analytics/src/infrastructure/llm/gemini_client.py` already supports the standard Gemini API.
    - Verify it handles `system_instruction` correctly for the `gemini-3-flash-preview` model.
    - Ensure it uses the new `GEMINI_API_KEY` from environment variables.
- [ ] **Factory Update:**
    - Verify `LLMProviderFactory` in `services/ai-analytics/src/adapters/llm/factory.py` correctly instantiates `GeminiClient`.
- [ ] **Prompt Optimization:**
    - Test the `SYSTEM_PROMPT` from `services/ai-analytics/src/infrastructure/prompts/system_prompts.py` with the new model.
    - `gemini-3-flash-preview` may have different sensitivities to prompt structure; ensure JSON output remains strict.

## 4. Database & Settings
- [ ] Update default `ai_settings` in `calls_schema.ai_settings` table via a new migration or seed script if needed, to set `gemini` as the default provider for new companies.
- [ ] Path: `services/main-api/internal/infrastructure/database/migrations/024_set_default_gemini_llm.sql` (Optional, if we want to force global default).

## 5. Testing & Validation
- [ ] Create a smoke test script `services/ai-analytics/test_gemini_analytics.py` to:
    - Send a sample transcript and script.
    - Verify JSON structure of the response.
    - Validate Russian language compliance.
- [ ] Compare analysis latency between the previous provider and Gemini 3 Flash.

## 6. Documentation
- [ ] Update `docs/services/ai-analytics.md` to highlight Gemini 3 Flash Preview as the primary analytics engine.
- [ ] Update architecture diagrams if provider-specific logos/names are used.
