import os
import asyncio
import logging
from typing import List, Dict, Any
from elevenlabs.client import ElevenLabs
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class ElevenLabsSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None, language: str = None):
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            logger.warning("ELEVENLABS_API_KEY is not set")
        self.client = ElevenLabs(api_key=self.api_key or "dummy")
        self.model = model or "scribe_v2"
        self.language = language

    async def transcribe(self, audio_path: str) -> dict:
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key missing")

        try:
            logger.info(f"Transcribing with ElevenLabs: {audio_path}", extra={"model": self.model, "language": self.language})
            
            with open(audio_path, "rb") as audio_file:
                # Use the new speech_to_text.convert method
                # According to docs, it returns SpeechToTextChunkResponseModel
                response = await asyncio.to_thread(
                    self.client.speech_to_text.convert,
                    file=audio_file,
                    model_id=self.model,
                    language_code=self.language,
                    diarize=True
                )

            full_text = response.text
            words = response.words
            segments = []
            
            if words:
                current_segment = None
                
                for word in words:
                    # Skip non-word tokens if necessary, though scribe includes spaces as 'spacing'
                    if word.type != "word":
                        if current_segment and word.type == "spacing":
                            current_segment["text"] += word.text
                        continue

                    speaker_id = f"SPEAKER_{word.speaker_id}" if word.speaker_id is not None else "UNKNOWN"

                    # Start a new segment if:
                    # 1. No current segment
                    # 2. Speaker changed
                    # 3. Time gap > 1.5s
                    if (current_segment is None or
                        current_segment["speaker"] != speaker_id or
                        (word.start - current_segment["end"]) > 1.5):

                        if current_segment:
                            current_segment["text"] = current_segment["text"].strip()
                            segments.append(current_segment)

                        current_segment = {
                            "start": word.start,
                            "end": word.end,
                            "text": word.text,
                            "speaker": speaker_id
                        }
                    else:
                        current_segment["text"] += word.text
                        current_segment["end"] = word.end

                if current_segment:
                    current_segment["text"] = current_segment["text"].strip()
                    segments.append(current_segment)

            logger.info(f"ElevenLabs transcription complete", extra={"audio_path": audio_path, "segments": len(segments)})

            return {
                "text": full_text.strip(),
                "segments": segments,
                "is_diarized": True
            }
        except Exception as e:
            logger.error("ElevenLabs STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"ElevenLabs STT failed: {str(e)}") from e
