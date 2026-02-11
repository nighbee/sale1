import os
import requests
import logging
from src.adapters.storage.postgres_repo import save_transcript
from src.adapters.events.redis_publisher import publish_transcript_ready

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")

    async def execute(self, job: dict):
        call_id = job.get('call_id')
        company_id = job.get('company_id')
        audio_url = job.get('audio_url')

        logger.info(f"Executing ProcessAudioUseCase for call: {call_id}")

        try:
            # Use data= for Form parameters as expected by stt-local
            resp = requests.post(f"{self.stt_local_url}/transcribe", data={"url": audio_url}, timeout=300)
            resp.raise_for_status()
            transcript_data = resp.json()

            # Transform to our internal format
            segments = []
            for seg in transcript_data.get("segments", []):
                segments.append({
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "speaker": "SPEAKER_0", # Default since stt-local doesn't diarize
                    "text": seg.get("text")
                })

            # In a real scenario, we would run a separate diarization step here
            # But the user said to use functional stt-local as is.

            final_transcript = {
                "call_id": call_id,
                "segments": segments,
                "text": transcript_data.get("text", "")
            }

            # Save to DB
            # We wrap the segments in the expected JSON column structure
            save_transcript(call_id, segments, "whisper-local")

            # Publish event
            await publish_transcript_ready(call_id, company_id)

            logger.info(f"Successfully processed call {call_id}")
        except Exception as e:
            logger.error(f"Error in ProcessAudioUseCase for call {call_id}: {e}")
            raise
