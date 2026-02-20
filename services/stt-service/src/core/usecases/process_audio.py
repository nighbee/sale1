import os
import httpx
import logging
import tempfile
from pydub import AudioSegment
from src.adapters.storage.postgres_repo import save_transcript, update_call_link
from src.adapters.events.redis_publisher import publish_transcript_ready
from src.adapters.storage.minio_client import MinioClient
from src.infrastructure.audio.diarization import DiarizationService, merge_transcript_with_diarization
from src.adapters.stt.openai_provider import OpenAISTTProvider
from src.adapters.stt.gemini_provider import GeminiSTTProvider
from src.adapters.stt.groq_provider import GroqSTTProvider
from src.adapters.stt.deepgram_provider import DeepgramSTTProvider

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")
        self.minio = MinioClient()
        self.diarization_service = DiarizationService()
        
        self.stt_provider_name = os.getenv("STT_PROVIDER", "openai")
        if self.stt_provider_name == "gemini":
            self.stt_provider = GeminiSTTProvider()
        elif self.stt_provider_name == "groq":
            self.stt_provider = GroqSTTProvider()
        elif self.stt_provider_name == "deepgram":
            self.stt_provider = DeepgramSTTProvider()
        else:
            self.stt_provider = OpenAISTTProvider()

    async def execute(self, job: dict):
        call_id = job.get('call_id')
        company_id = job.get('company_id')
        # Support both key names: 'audio_url' (sipuni-listener) and 'call_link' (sheets-sync legacy)
        audio_url = job.get('audio_url') or job.get('call_link')

        if not audio_url:
            raise ValueError(f"Missing audio URL for call_id={call_id}: job has no 'audio_url' or 'call_link' field")

        logger.info(
            "processing audio job",
            extra={"call_id": call_id, "company_id": company_id,
                   "audio_url": audio_url, "stt_provider": self.stt_provider_name},
        )

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

            # 4. Transcribe (using API provider)
            # Old local STT logic commented out:
            # async with httpx.AsyncClient() as client:
            #     # Note: stt-local expected 'url' in form data.
            #     # Since we archived it, we can still use the original url or the new minio url if stt-local supports it.
            #     # PRD says stt-local uses the URL.
            #     resp = await client.post(f"{self.stt_local_url}/transcribe", data={"url": audio_url}, timeout=300)
            #     resp.raise_for_status()
            #     transcript_data = resp.json()

            # New API logic:
            # Send the original compressed MP3 to the STT API — WAV is uncompressed
            # and can exceed provider size limits (e.g. Groq 25 MB free tier).
            # All API providers (OpenAI, Groq, Gemini) handle MP3 natively and
            # do their own 16 kHz downsampling server-side.
            transcript_data = await self.stt_provider.transcribe(tmp_path)

            # 5. Diarization (still uses the 16 kHz WAV for local processing)
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
            save_transcript(call_id, segments, self.stt_provider_name)

            # Publish event
            await publish_transcript_ready(call_id, company_id)

            logger.info("audio job completed successfully", extra={"call_id": call_id, "company_id": company_id})
        except Exception as e:
            logger.error("audio job failed", extra={"call_id": call_id, "company_id": company_id, "error": str(e)})
            raise
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
