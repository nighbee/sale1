import os
import logging
import tempfile
import asyncio
from src.adapters.storage.postgres_repo import get_latest_minio_call
from src.adapters.storage.minio_client import MinioClient
from src.core.ports.downloader_factory import DownloaderFactory
from src.adapters.stt.factory import STTProviderFactory

logger = logging.getLogger(__name__)

class CheckModelUseCase:
    def __init__(self):
        self.minio = MinioClient()

    async def execute(self, provider_name: str, credentials: dict = None, model: str = None):
        logger.info(f"Checking model for provider: {provider_name}")

        # 1. Get a sample call with MinIO link
        call = await asyncio.to_thread(get_latest_minio_call)
        if not call:
            raise ValueError("No sample audio found in MinIO. Please process at least one call first.")

        call_id, audio_url = call
        logger.info(f"Using sample call {call_id} with URL {audio_url}")

        tmp_path = None
        try:
            # 2. Download audio
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                tmp_path = tmp.name

            downloader = DownloaderFactory.create(audio_url, self.minio)
            await downloader.download(audio_url, tmp_path)

            # 3. Transcribe
            # For testing, we pass the credentials directly if provided
            # We mock the integrations list for the factory if we have direct credentials
            integrations = []
            if credentials:
                integrations.append({
                    "integration_type": provider_name,
                    "credentials": credentials
                })

            stt_provider = STTProviderFactory.create(provider_name, integrations, default_model=model)

            transcript_data = await stt_provider.transcribe(tmp_path)
            text = transcript_data.get("text", "")

            if not text.strip():
                raise ValueError("STT provider returned an empty transcript.")

            return {
                "success": True,
                "transcript": text,
                "call_id": call_id
            }

        except Exception as e:
            logger.error(f"Check model failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
