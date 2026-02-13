import os
import requests
import logging
from src.adapters.storage.postgres_repo import save_transcript
from src.adapters.storage.minio_client import MinioClient
from src.adapters.events.redis_publisher import publish_transcript_ready

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")
        self.minio_client = MinioClient()

    async def execute(self, job: dict):
        call_id = job.get('call_id')
        company_id = job.get('company_id')
        audio_url = job.get('audio_url')

        logger.info(f"Executing ProcessAudioUseCase for call: {call_id}")

        try:
            # 1. Download audio
            tmp_path = f"/tmp/{call_id}.mp3"
            logger.info(f"Downloading audio from {audio_url} to {tmp_path}")
            r = requests.get(audio_url, stream=True)
            r.raise_for_status()
            with open(tmp_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

            # 2. Upload to MinIO
            object_name = f"{call_id}.mp3"
            self.minio_client.upload_file(object_name, tmp_path)

            # 3. Transcribe
            # We can send the file to stt-local
            with open(tmp_path, 'rb') as f:
                files = {'file': (object_name, f, 'audio/mpeg')}
                resp = requests.post(f"{self.stt_local_url}/transcribe", files=files, timeout=300)

            resp.raise_for_status()
            transcript_data = resp.json()

            # Clean up tmp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

            # Transform to our internal format with mock diarization
            segments = []
            for i, seg in enumerate(transcript_data.get("segments", [])):
                # Mock diarization by alternating speakers every 2 segments
                # In a real system, we'd use a diarization model like Pyannote
                speaker = f"SPEAKER_{ (i // 2) % 2 }"
                segments.append({
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "speaker": speaker,
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
