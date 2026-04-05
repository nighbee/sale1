# AI Provider Abstraction Layer

## Overview
SalesAI implements a provider-agnostic abstraction layer for AI services (Speech-to-Text and Large Language Models). This allows the system to remain flexible and leverage different models based on performance, cost, and availability.

---

## 1. Speech-to-Text (STT) Abstraction

The `STTProvider` port defines a unified interface for transcription.

### Interface (`stt_provider.py`)
```python
class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        """Transcribe audio and return standard JSON result."""
        pass

    @abstractmethod
    async def get_models(self) -> list:
        """List available models for the provider."""
        pass

    def supports_url_transcription(self, url: str) -> bool:
        """Check if provider can transcribe directly from a remote URL."""
        return False
```

### Supported STT Adapters

| Provider | Model(s) | Strengths | Use Case |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `whisper-1` | High accuracy, multi-lingual support. | Default high-quality transcription. |
| **ElevenLabs** | `scribe_v2`, `scribe_v1` | Exceptional diarization, low latency. | High-fidelity speaker separation. |
| **Soniox** | `stt-async-v4` | Advanced diarization and punctuation. | Enterprise-grade audio processing. |
| **Deepgram** | `nova-3` | Extremely fast, direct URL transcription. | Real-time or high-volume batch processing. |
| **WhisperX** | Local (Self-hosted) | No API costs, data privacy. | Sensitive data or high-volume cost reduction. |

---

## 2. Large Language Model (LLM) Abstraction

The `LLMProvider` port defines a unified interface for call analysis.

### Interface (`llm_provider.py`)
```python
class LLMProvider(ABC):
    @abstractmethod
    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        """Analyze call transcript and return structured JSON report."""
        pass
```

### Supported LLM Adapters

| Provider | Model(s) | Strengths | Use Case |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `gpt-4o`, `gpt-3.5-turbo` | Reasoning, instruction following. | Complex call evaluation and KPI calculation. |
| **Google** | `gemini-1.5-flash`, `gemini-1.5-pro` | Large context window, fast processing. | Long-form analysis and multi-call comparison. |
| **Azure AI** | `gpt-4` | Enterprise compliance, SLA. | Regulated industries (Banking, Health). |

---

## 3. Provider Comparison & Strategy

### Selection Logic
The `stt-service` and `ai-analytics` services dynamically select the provider based on:
1. **Tenant Preference**: Configured in `auth_schema.companies`.
2. **Circuit Breaker Status**: Fallback to a secondary provider if the primary fails.
3. **Audio Capability**: If the audio is already hosted on a supported public URL, providers like Deepgram or Soniox are prioritized to skip downloading.

### Comparison Matrix

| Feature | OpenAI | ElevenLabs | Soniox | Deepgram | Gemini |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Native Diarization | ✅ | ✅ | ✅ | ✅ | ❌ |
| URL Transcription | ❌ | ❌ | ✅ | ✅ | ❌ |
| Speed (Latency) | Medium | Medium | Fast | Extremely Fast | Fast |
| Accuracy | High | High | Very High | High | High |
| Multi-lingual | Excellent | Good | Good | Good | Excellent |

---

## Suggested Improvements (Non-Breaking)
- **Unified Billing**: Implement a tracking system for token/minute usage across all providers to provide unified billing for tenants.
- **Provider Health Checks**: Add a proactive monitoring system to ping provider APIs and update Circuit Breaker states before jobs are pulled from the queue.
