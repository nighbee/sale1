import os
import asyncio
import logging
from typing import List, Dict, Any
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

    async def transcribe(self, audio_path: str) -> dict:
        if not self.api_key:
            raise RuntimeError("ElevenLabs API key missing")

        try:
            logger.info(f"Transcribing with ElevenLabs: {audio_path}")
            
            with open(audio_path, "rb") as audio_file:
                transcript = await asyncio.to_thread(
                    self.client.scribe.transcribe,
                    file=audio_file,
                    model_id=self.model,
                )

            full_text = ""
            segments = []
            
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

            logger.info(f"ElevenLabs transcription complete", extra={"audio_path": audio_path, "segments": len(segments)})

            return {
                "text": full_text.strip(),
                "segments": segments,
                "is_diarized": True
            }
        except Exception as e:
            logger.error("ElevenLabs STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"ElevenLabs STT failed: {str(e)}") from e
