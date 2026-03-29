import logging
import asyncio
from src.core.ports.audio_downloader import AudioDownloader
from src.adapters.storage.minio_client import MinioClient

logger = logging.getLogger(__name__)

class MinioDownloader(AudioDownloader):
    def __init__(self, minio_client: MinioClient = None, max_attempts: int = 3, base_backoff: float = 2.0):
        self.minio = minio_client or MinioClient()
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff

    async def download(self, url: str, target_path: str) -> None:
        # Expected format: minio://bucket/object_name or minio://object_name (if bucket is fixed)
        # MinioClient current implementation uses its own bucket_name "audio"
        parts = url.replace("minio://", "").split("/")
        if len(parts) < 1:
            raise ValueError(f"Invalid minio URL: {url}")

        # If there's more than one part, the first might be the bucket
        # but MinioClient.download_file only takes object_name and uses self.bucket_name
        object_name = "/".join(parts[1:]) if len(parts) > 1 else parts[0]

        for attempt in range(1, self.max_attempts + 1):
            try:
                logger.info(
                    f"MinIO download attempt {attempt}/{self.max_attempts}",
                    extra={"url": url, "object_name": object_name}
                )
                # MinioClient.download_file is synchronous, we run it in a thread
                await asyncio.to_thread(self.minio.download_file, object_name, target_path)
                logger.info("MinIO download completed successfully", extra={"url": url})
                return
            except Exception as e:
                logger.warning(
                    f"MinIO download attempt {attempt} failed: {e}",
                    extra={"url": url, "attempt": attempt}
                )
                if attempt == self.max_attempts:
                    raise

                backoff = self.base_backoff * (2 ** (attempt - 1))
                await asyncio.sleep(backoff)
