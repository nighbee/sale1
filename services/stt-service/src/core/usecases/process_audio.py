import os
import json
import httpx
import logging
import tempfile
import time
from src.adapters.storage.postgres_repo import save_transcript, update_call_link
from src.adapters.events.redis_publisher import publish_transcript_ready
from src.adapters.storage.minio_client import MinioClient
from src.infrastructure.audio.diarization import DiarizationService, merge_transcript_with_diarization
from src.infrastructure.audio.converter import AudioConverter
from src.adapters.stt.openai_provider import OpenAISTTProvider
from src.adapters.stt.gemini_provider import GeminiSTTProvider
from src.adapters.stt.groq_provider import GroqSTTProvider
from src.adapters.stt.deepgram_provider import DeepgramSTTProvider
from src.infrastructure.api.main_api_client import MainAPIClient

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")
        self.minio = MinioClient()
        self.diarization_service = DiarizationService()
        self.api_client = MainAPIClient()
        
        # We will initialize provider on each execute to handle dynamic credentials
        self.stt_provider_name = os.getenv("STT_PROVIDER", "openai")

    def _get_stt_provider(self, integrations: list):
        provider_name = self.stt_provider_name

        # Look for integration that matches provider_name
        integration = next((i for i in integrations if i.get("integration_type") == provider_name), None)

        api_key = None
        if integration:
            creds = integration.get("credentials", {})
            if isinstance(creds, str):
                try:
                    creds = json.loads(creds)
                except:
                    pass
            if isinstance(creds, dict):
                api_key = creds.get("api_key")

        if provider_name == "gemini":
            return GeminiSTTProvider(api_key=api_key)
        elif provider_name == "groq":
            return GroqSTTProvider(api_key=api_key)
        elif provider_name == "deepgram":
            return DeepgramSTTProvider(api_key=api_key)
        else:
            return OpenAISTTProvider(api_key=api_key)

    async def execute(self, job: dict):
        call_id = job.get('call_id')
        # Support both key names: 'audio_url' (sipuni-listener) and 'call_link' (sheets-sync legacy)
        audio_url = job.get('audio_url') or job.get('call_link')

        if not audio_url:
            raise ValueError(f"Missing audio URL for call_id={call_id}: job has no 'audio_url' or 'call_link' field")

        logger.info(
            "processing audio job",
            extra={"call_id": call_id,
                   "audio_url": audio_url, "stt_provider": self.stt_provider_name},
        )

        tmp_path = None
        wav_path = None
        t_total = time.monotonic()
        try:
            # 1. Download audio
            logger.info("[1/6] downloading audio",
                        extra={"call_id": call_id, "audio_url": audio_url})
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                tmp_path = tmp.name
                async with httpx.AsyncClient() as client:
                    async with client.stream("GET", audio_url, timeout=60) as response:
                        response.raise_for_status()
                        async for chunk in response.aiter_bytes():
                            tmp.write(chunk)
            file_size_kb = round(os.path.getsize(tmp_path) / 1024, 1)
            logger.info("[1/6] audio downloaded",
                        extra={"call_id": call_id, "file_size_kb": file_size_kb, "tmp_path": tmp_path})

            # 2. Convert to 16kHz WAV
            logger.info("[2/6] converting to 16kHz WAV", extra={"call_id": call_id})
            duration_s = AudioConverter.get_duration_seconds(tmp_path)
            wav_path = AudioConverter.to_stt_wav(tmp_path)
            wav_size_kb = round(os.path.getsize(wav_path) / 1024, 1)
            logger.info("[2/6] WAV conversion done",
                        extra={"call_id": call_id, "duration_s": duration_s,
                               "wav_size_kb": wav_size_kb, "wav_path": wav_path})

            # 3. Archive to MinIO
            logger.info("[3/6] uploading to MinIO", extra={"call_id": call_id, "object_name": f"{call_id}.wav"})
            object_name = f"{call_id}.wav"
            self.minio.upload_file(object_name, wav_path)
            logger.info("[3/6] MinIO upload done", extra={"call_id": call_id, "object_name": object_name})

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
            logger.info("[4/6] sending to STT provider",
                        extra={"call_id": call_id, "stt_provider": self.stt_provider_name,
                               "file_size_kb": file_size_kb})

            integrations = await self.api_client.get_active_integrations()
            stt_provider = self._get_stt_provider(integrations)

            t_stt = time.monotonic()
            transcript_data = await stt_provider.transcribe(tmp_path)
            stt_elapsed = round(time.monotonic() - t_stt, 2)
            stt_text = transcript_data.get("text", "")
            stt_segments = transcript_data.get("segments", [])
            logger.info("[4/6] STT transcription received",
                        extra={"call_id": call_id, "stt_provider": self.stt_provider_name,
                               "elapsed_s": stt_elapsed, "segment_count": len(stt_segments),
                               "text_length": len(stt_text),
                               "text_preview": stt_text[:200] if stt_text else ""})

            # 5. Diarization (still uses the 16 kHz WAV for local processing)
            logger.info("[5/6] running diarization", extra={"call_id": call_id, "wav_path": wav_path})
            diarization_segments = self.diarization_service.process(wav_path)
            logger.info("[5/6] diarization done",
                        extra={"call_id": call_id,
                               "diarization_segments": len(diarization_segments) if diarization_segments else 0})

            # 6. Transform and Merge
            logger.info("[6/6] merging transcript with diarization", extra={"call_id": call_id})
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
            await publish_transcript_ready(call_id)

            total_elapsed = round(time.monotonic() - t_total, 2)
            logger.info(
                "[6/6] audio job completed successfully",
                extra={
                    "call_id": call_id,
                    "stt_provider": self.stt_provider_name,
                    "duration_s": duration_s,
                    "segment_count": len(segments),
                    "text_length": len(stt_text),
                    "total_elapsed_s": total_elapsed,
                    "published_stream": "transcript_ready",
                },
            )
        except Exception as e:
            logger.error("audio job failed", extra={"call_id": call_id, "error": str(e)})
            raise
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
