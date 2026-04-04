# STT Transcription Strategies

The STT service uses a Strategy Pattern to handle different ways of transcribing audio. Depending on the provider's capabilities, the service can either download and process audio locally or send a URL directly to the provider.

## Core Interface

The `STTProvider` port defines the following methods relevant to transcription strategies:

```python
class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        """
        Transcribe audio file.

        Args:
            audio_path (str): Path to the local audio file.
            audio_url (str, optional): Remote URL to the audio file if provider supports direct URL transcription.
            language (str, optional): Language code for transcription (e.g., 'en', 'ru').
        """
        pass

    def supports_url_transcription(self, url: str) -> bool:
        """
        Check if the provider supports direct transcription from the given URL.
        """
        return False
```

## Available Strategies

### 1. Download & Convert (Default)
Most providers (OpenAI, Gemini, Groq, ElevenLabs) require the audio file to be sent in the request body.

**Workflow:**
1. Download audio from `audio_url` to a temporary location.
2. Convert audio to 16kHz WAV format (for optimal compatibility and diarization).
3. Upload WAV to internal MinIO storage.
4. Pass the local `audio_path` to `stt_provider.transcribe()`.

### 2. Direct URL Transcription
Some providers (Soniox, Deepgram) can fetch the audio directly from a public or pre-signed URL.

**Workflow:**
1. Check `stt_provider.supports_url_transcription(audio_url)`.
2. If `True`, skip download, conversion, and MinIO archiving.
3. Pass the `audio_url` to `stt_provider.transcribe()`.
4. The provider handles the download and processing on their side.

## Implementing a New Strategy

To enable direct URL transcription for a new provider:

1. Override `supports_url_transcription(self, url: str) -> bool` in your provider class.
2. Update `transcribe()` to handle the `audio_url` parameter if it's provided.
3. Ensure the provider can access the given URL (e.g., it's not a private MinIO link).

## Benefits

- **Reduced Latency**: Skipping the download/convert/upload cycle significantly speeds up transcription.
- **Lower Resource Usage**: Reduces CPU and bandwidth usage on the STT service.
- **Cost Efficiency**: Some providers offer faster or cheaper processing for direct URL inputs.
