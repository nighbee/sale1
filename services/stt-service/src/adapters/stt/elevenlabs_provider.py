import os
import asyncio
import logging
from typing import List, Dict, Any, Optional
from elevenlabs.client import ElevenLabs
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class ElevenLabsSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            logger.warning("ELEVENLABS_API_KEY is not set")
        self.client = ElevenLabs(api_key=self.api_key or "dummy")
        self.model = model or "scribe_v1"

    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key missing")

        try:
            logger.info(f"Transcribing with ElevenLabs: {audio_path}", extra={"language": language})
            
            with open(audio_path, "rb") as audio_file:
                transcript = await asyncio.to_thread(
                    self.client.speech_to_text.convert,
                    file=audio_file,
                    model_id=self.model,
                    language_code=language,
                    diarize=True
                )

            full_text = ""
            segments = []
            
            # The new Scribe v2 response has transcript.words and transcript.segments
            # If transcript.segments is available, we use it.
            if hasattr(transcript, 'segments') and transcript.segments:
                for segment in transcript.segments:
                    speaker_id = f"SPEAKER_{segment.speaker_id}" if segment.speaker_id is not None else "UNKNOWN"

                    seg_data = {
                        "start": segment.start_time,
                        "end": segment.end_time,
                        "text": segment.text,
                        "speaker": speaker_id
                    }
                    segments.append(seg_data)
                    full_text += segment.text + " "
            else:
                # Fallback to word-level reconstruction if segments are missing
                full_text = transcript.text
                # If we have words but no segments, we might need to group them.
                # For now, let's assume scribe_v2 provides segments when diarize=True.
                if hasattr(transcript, 'words'):
                    current_speaker = None
                    current_segment = None

                    for word in transcript.words:
                        speaker_id = f"SPEAKER_{word.speaker_id}" if word.speaker_id is not None else "UNKNOWN"

                        if speaker_id != current_speaker:
                            if current_segment:
                                segments.append(current_segment)
                            current_speaker = speaker_id
                            current_segment = {
                                "start": word.start_time,
                                "end": word.end_time,
                                "text": word.text,
                                "speaker": speaker_id
                            }
                        else:
                            current_segment["end"] = word.end_time
                            current_segment["text"] += " " + word.text

                    if current_segment:
                        segments.append(current_segment)

            logger.info(f"ElevenLabs transcription complete", extra={"audio_path": audio_path, "segments": len(segments)})

            return {
                "text": full_text.strip(),
                "segments": segments,
                "is_diarized": True
            }
        except Exception as e:
            msg = str(e)
            # Detect common permission error returned by ElevenLabs API
            if 'missing_permissions' in msg or 'missing permission' in msg or 'speech_to_text' in msg:
                logger.error(
                    "ElevenLabs STT failed due to API key permissions",
                    extra={
                        "error": msg,
                        "audio_path": audio_path,
                        "hint": "The provided ElevenLabs API key appears to be missing the `speech_to_text` permission. Create a key with speech_to_text (Scribe) enabled and set ELEVENLABS_API_KEY in your environment or integration settings."
                    }
                )
                raise RuntimeError(
                    "ElevenLabs STT failed: API key missing `speech_to_text` permission. Create a key with Scribe/speech_to_text permission and set ELEVENLABS_API_KEY."
                ) from e

            logger.error("ElevenLabs STT failed", extra={"error": msg, "audio_path": audio_path})
            raise RuntimeError(f"ElevenLabs STT failed: {msg}") from e

    async def get_models(self) -> list:
        try:
            models = await asyncio.to_thread(self.client.models.list)
            # Scribe models might not always be in the list yet as it's a separate API
            # but we should include them if found, or provide them as default.
            model_ids = [m.model_id for m in models]

            # Ensure Scribe models are present in the suggestions
            scribe_models = ["scribe_v2", "scribe_v1", "scribe_v1_experimental"]
            for sm in scribe_models:
                if sm not in model_ids:
                    model_ids.insert(0, sm)

            return model_ids
        except Exception as e:
            logger.error(f"Failed to fetch ElevenLabs models: {e}")
            return ["scribe_v2", "scribe_v1", "scribe_v1_experimental"]
