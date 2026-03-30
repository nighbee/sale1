import os
import logging
from src.core.ports.audio_downloader import AudioDownloader
from src.infrastructure.audio.http_downloader import HTTPDownloader
from src.infrastructure.audio.minio_downloader import MinioDownloader
from src.infrastructure.audio.curl_downloader import CurlDownloader
from src.infrastructure.audio.fallback_downloader import FallbackDownloader
from src.adapters.storage.minio_client import MinioClient

logger = logging.getLogger(__name__)

class DownloaderFactory:
    @staticmethod
    def create(url: str, minio_client: MinioClient = None) -> AudioDownloader:
        if url.startswith("minio://"):
            logger.info("Using MinioDownloader", extra={"url": url})
            return MinioDownloader(minio_client)

        strategy = os.getenv("STT_DOWNLOAD_STRATEGY", "resilient").lower()

        # Define standard HTTP downloaders with fallback
        # HTTPDownloader (httpx) -> CurlDownloader (subprocess)
        http_downloaders = [
            HTTPDownloader(),
            CurlDownloader()
        ]

        if strategy == "curl":
            logger.info("Using CurlDownloader strategy", extra={"url": url})
            return CurlDownloader()

        if strategy == "http":
            logger.info("Using HTTPDownloader strategy", extra={"url": url})
            return HTTPDownloader()

        # Default strategy is resilient fallback
        logger.info("Using resilient FallbackDownloader strategy", extra={"url": url, "strategy": strategy})
        return FallbackDownloader(http_downloaders)
