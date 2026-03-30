import os
import asyncio
import logging
from typing import List, Dict, Any
from elevenlabs.client import ElevenLabs
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class ElevenLabsSTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY is not set")
        self.client = ElevenLabs(api_key=self.api_key)

    async def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe audio using ElevenLabs Scribe API.
        Scribe automatically performs diarization.
        """
        try:
            logger.info(f"Uploading file to ElevenLabs Scribe: {audio_path}")
            
            # Using asyncio.to_thread because the elevenlabs SDK might be blocking
            with open(audio_path, "rb") as audio_file:
                transcript = await asyncio.to_thread(
                    self.client.scribe.transcribe,
                    file=audio_file,
                    model_id="scribe_v1", # Default Scribe model
                    # Scribe performs diarization by default
                )

            full_text = ""
            segments = []
            
            # ElevenLabs Scribe returns a list of segments with speaker information
            for segment in transcript.segments:
                speaker_id = f"SPEAKER_{segment.speaker_id}" if segment.speaker_id is not None else "UNKNOWN"
                
                # Scribe segment has start_time, end_time, and text
                # times are in seconds (float)
                seg_data = {
                    "start": segment.start_time,
                    "end": segment.end_time,
                    "text": segment.text,
                    "speaker": speaker_id
                }
                segments.append(seg_data)
                full_text += segment.text + " "

            logger.info(f"ElevenLabs transcription completed: {len(segments)} segments")

            return {
                "text": full_text.strip(),
                "segments": segments,
                "is_diarized": True  # Explicitly mark that we already have diarization
            }
        except Exception as e:
            logger.error(f"ElevenLabs STT failed: {str(e)}")
            raise Exception(f"ElevenLabs STT failed: {str(e)}")
