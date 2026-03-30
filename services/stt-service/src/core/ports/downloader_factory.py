import os
import logging
from src.core.ports.audio_downloader import AudioDownloader
from src.infrastructure.audio.http_downloader import HTTPDownloader
from src.infrastructure.audio.minio_downloader import MinioDownloader
from src.infrastructure.audio.curl_downloader import CurlDownloader
from src.infrastructure.audio.playwright_downloader import PlaywrightDownloader
from src.infrastructure.audio.fallback_downloader import FallbackDownloader
from src.infrastructure.audio.resilient_downloader import ResilientDownloader
from src.adapters.storage.minio_client import MinioClient

logger = logging.getLogger(__name__)

class DownloaderFactory:
    @staticmethod
    def create(url: str, minio_client: MinioClient = None) -> AudioDownloader:
        if url.startswith("minio://"):
            logger.info("Using MinioDownloader", extra={"url": url})
            return MinioDownloader(minio_client)

        strategy = os.getenv("STT_DOWNLOAD_STRATEGY", "pipeline").lower()

        if strategy == "curl":
            logger.info("Using pure CurlDownloader strategy", extra={"url": url})
            return CurlDownloader()

        if strategy == "http":
            logger.info("Using pure HTTPDownloader strategy", extra={"url": url})
            return HTTPDownloader()

        if strategy == "playwright":
            logger.info("Using PlaywrightDownloader strategy", extra={"url": url})
            return PlaywrightDownloader()

        if strategy == "fallback":
            logger.info("Using basic FallbackDownloader (HTTP -> Curl)", extra={"url": url})
            return FallbackDownloader([HTTPDownloader(), CurlDownloader()])

        # Default strategy is the new resilient Pipeline
        logger.info("Using Resilient Pipeline strategy", extra={"url": url, "strategy": strategy})
        return ResilientDownloader()
