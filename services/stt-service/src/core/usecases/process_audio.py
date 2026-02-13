import os
import httpx
import logging
import tempfile
from pydub import AudioSegment
from src.adapters.storage.postgres_repo import save_transcript, update_call_link
from src.adapters.events.redis_publisher import publish_transcript_ready
from src.adapters.storage.minio_client import MinioClient
from src.infrastructure.audio.diarization import DiarizationService, merge_transcript_with_diarization

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")
        self.minio = MinioClient()
        self.diarization_service = DiarizationService()

    async def execute(self, job: dict):
        call_id = job.get('call_id')
        company_id = job.get('company_id')
        audio_url = job.get('audio_url')

        logger.info(f"Executing ProcessAudioUseCase for call: {call_id}")

        tmp_path = None
        wav_path = None
        try:
            # 1. Download audio
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                tmp_path = tmp.name
                async with httpx.AsyncClient() as client:
                    async with client.stream("GET", audio_url, timeout=60) as response:
                        response.raise_for_status()
                        async for chunk in response.aiter_bytes():
                            tmp.write(chunk)

            # 2. Convert to 16kHz WAV
            wav_path = tmp_path.replace(".mp3", ".wav")
            audio = AudioSegment.from_file(tmp_path)
            audio = audio.set_frame_rate(16000).set_channels(1)
            audio.export(wav_path, format="wav")

            # 3. Archive to MinIO
            object_name = f"{call_id}.wav"
            self.minio.upload_file(object_name, wav_path)

            # Update call record with MinIO reference
            update_call_link(call_id, f"minio://audio/{object_name}")

            # 4. Transcribe (using local stt-local)
            async with httpx.AsyncClient() as client:
                # Note: stt-local expected 'url' in form data.
                # Since we archived it, we can still use the original url or the new minio url if stt-local supports it.
                # PRD says stt-local uses the URL.
                resp = await client.post(f"{self.stt_local_url}/transcribe", data={"url": audio_url}, timeout=300)
                resp.raise_for_status()
                transcript_data = resp.json()

            # 5. Diarization
            diarization_segments = self.diarization_service.process(wav_path)

            # 6. Transform and Merge
            transcript_segments = []
            for seg in transcript_data.get("segments", []):
                transcript_segments.append({
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "text": seg.get("text")
                })

            segments = merge_transcript_with_diarization(transcript_segments, diarization_segments)

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
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
