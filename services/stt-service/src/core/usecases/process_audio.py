import os
import json
import httpx
import asyncio
import logging
import tempfile
import time
from urllib.parse import urlparse
from src.adapters.storage.postgres_repo import save_transcript, update_call_link, get_call_link
from src.adapters.events.redis_publisher import publish_transcript_ready
from src.adapters.storage.minio_client import MinioClient
from src.infrastructure.audio.diarization import DiarizationService, merge_transcript_with_diarization
from src.infrastructure.audio.converter import AudioConverter
from src.adapters.stt.factory import STTProviderFactory
from src.infrastructure.api.main_api_client import MainAPIClient
from src.core.ports.downloader_factory import DownloaderFactory

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")
        self.minio = MinioClient()
        self.diarization_service = DiarizationService()
        self.api_client = MainAPIClient()
        
        # We will initialize provider on each execute to handle dynamic credentials
        self.stt_provider_name = os.getenv("STT_PROVIDER", "openai")


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
            logger.info("[1/6] downloading audio", extra={"call_id": call_id, "audio_url": audio_url})

            # Check if MinIO link already exists in the database
            db_call_link = await asyncio.to_thread(get_call_link, call_id)
            if db_call_link and db_call_link.startswith("minio://"):
                logger.info("MinIO link found in database, prioritizing it", extra={"call_id": call_id, "minio_link": db_call_link})
                audio_url = db_call_link

            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                tmp_path = tmp.name

            downloader = DownloaderFactory.create(audio_url, self.minio)
            await downloader.download(audio_url, tmp_path)

            # Safety validation after download
            file_size = os.path.getsize(tmp_path)
            if file_size < 5 * 1024:  # 5KB sanity check (reduced from 50KB to allow short valid calls)
                raise RuntimeError(f"Downloaded file too small: {file_size} bytes")

            file_size_kb = round(file_size / 1024, 1)
            logger.info("[1/6] audio downloaded", extra={"call_id": call_id, "file_size_kb": file_size_kb, "tmp_path": tmp_path})

            # 2. Convert to 16kHz WAV
            logger.info("[2/6] converting to 16kHz WAV", extra={"call_id": call_id})
            duration_s = await AudioConverter.get_duration_seconds(tmp_path)
            wav_path = await AudioConverter.to_stt_wav(tmp_path)
            wav_size_kb = round(os.path.getsize(wav_path) / 1024, 1)
            logger.info("[2/6] WAV conversion done",
                        extra={"call_id": call_id, "duration_s": duration_s,
                               "wav_size_kb": wav_size_kb, "wav_path": wav_path})

            # 3. Archive to MinIO
            logger.info("[3/6] uploading to MinIO", extra={"call_id": call_id, "object_name": f"{call_id}.wav"})
            object_name = f"{call_id}.wav"
            await asyncio.to_thread(self.minio.upload_file, object_name, wav_path)
            logger.info("[3/6] MinIO upload done", extra={"call_id": call_id, "object_name": object_name})

            # Update call record with MinIO reference
            await asyncio.to_thread(update_call_link, call_id, f"minio://audio/{object_name}")

            # 4. Transcribe (using API provider)
            # Send the original compressed MP3 to the STT API — WAV is uncompressed
            # and can exceed provider size limits (e.g. Groq 25 MB free tier).
            # All API providers (OpenAI, Groq, Gemini) handle MP3 natively and
            # do their own 16 kHz downsampling server-side.

            # Fetch default settings from main-api
            ai_settings = await self.api_client.get_ai_settings()

            # Priority: 1. Job metadata 2. integrations (DB) 3. .env
            stt_provider_name = job.get("stt_provider")
            stt_model_name = job.get("stt_model")
            stt_language = job.get("stt_language")

            if ai_settings:
                stt_provider_name = stt_provider_name or ai_settings.get("stt_provider")
                stt_model_name = stt_model_name or ai_settings.get("stt_model")
                # ai_settings doesn't have stt_language currently, but let's be prepared

            # Fallback to .env
            stt_provider_name = stt_provider_name or self.stt_provider_name

            logger.info("[4/6] sending to STT provider",
                        extra={"call_id": call_id, "stt_provider": stt_provider_name,
                               "stt_model": stt_model_name,
                               "stt_language": stt_language,
                               "file_size_kb": file_size_kb})

            integrations = await self.api_client.get_active_integrations()
            stt_provider = STTProviderFactory.create(
                stt_provider_name,
                integrations,
                default_model=stt_model_name,
                default_language=stt_language
            )

            t_stt = time.monotonic()
            try:
                transcript_data = await stt_provider.transcribe(tmp_path)
            except Exception as e:
                logger.error(
                    "STT provider transcription failed",
                    extra={
                        "call_id": call_id,
                        "stt_provider": stt_provider_name,
                        "error": str(e)
                    }
                )
                raise
            stt_elapsed = round(time.monotonic() - t_stt, 2)
            stt_text = transcript_data.get("text", "")
            stt_segments = transcript_data.get("segments", [])

            # Fallback: if text is present but segments are missing, create a single segment
            if stt_text.strip() and not stt_segments:
                logger.info(
                    "STT provider returned text but no segments, using fallback",
                    extra={"call_id": call_id, "stt_provider": stt_provider_name}
                )
                stt_segments = [{
                    "start": 0.0,
                    "end": duration_s or 0.0,
                    "text": stt_text
                }]
                transcript_data["segments"] = stt_segments
            logger.info("[4/6] STT transcription received",
                        extra={"call_id": call_id, "stt_provider": stt_provider_name,
                               "elapsed_s": stt_elapsed, "count": len(stt_segments),
                               "text_length": len(stt_text),
                               "text_preview": stt_text[:200] if stt_text else ""})

            # 5. Diarization (only if not already diarized by provider)
            is_diarized = transcript_data.get("is_diarized", False)
            if not is_diarized:
                logger.info("[5/6] running local diarization", extra={"call_id": call_id, "wav_path": wav_path})
                diarization_segments = await self.diarization_service.process(wav_path)
                logger.info("[5/6] diarization done",
                            extra={"call_id": call_id,
                                   "diarization_segments": len(diarization_segments) if diarization_segments else 0})
            else:
                logger.info("[5/6] skipping local diarization (already diarized by provider)", extra={"call_id": call_id})
                diarization_segments = []

            # 6. Transform and Merge
            logger.info("[6/6] merging transcript with diarization", extra={"call_id": call_id})
            transcript_segments = []
            for seg in transcript_data.get("segments", []):
                transcript_segments.append({
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "text": seg.get("text"),
                    "speaker": seg.get("speaker") # Preserving speaker if present
                })

            if not is_diarized:
                segments = merge_transcript_with_diarization(transcript_segments, diarization_segments)
            else:
                # If already diarized, we just use the transcript segments directly
                segments = transcript_segments

            final_transcript = {
                "call_id": call_id,
                "segments": segments,
                "text": transcript_data.get("text", "")
            }

            # Save to DB
            # We wrap the segments in the expected JSON column structure
            await asyncio.to_thread(save_transcript, call_id, segments, stt_provider_name)

            # Publish event
            await publish_transcript_ready(call_id)

            total_elapsed = round(time.monotonic() - t_total, 2)
            logger.info(
                "[6/6] audio job completed successfully",
                extra={
                    "call_id": call_id,
                    "stt_provider": stt_provider_name,
                    "duration_s": duration_s,
                    "segment_count": len(segments),
                    "text_length": len(stt_text),
                    "total_elapsed_s": total_elapsed,
                    "published_stream": "transcript_ready",
                },
            )
        except Exception as e:
            # capture full traceback so higher-level consumers/logs see the real error
            import traceback
            tb = traceback.format_exc()
            # logger.exception will write the traceback to logs; include tb in extra so structured logs show it
            logger.exception("audio job failed", extra={"call_id": call_id, "error": tb[:2000]})
            raise
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
