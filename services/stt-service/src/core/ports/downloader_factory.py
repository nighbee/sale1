import os
from src.core.ports.audio_downloader import AudioDownloader
from src.infrastructure.audio.http_downloader import HTTPDownloader
from src.infrastructure.audio.minio_downloader import MinioDownloader
from src.infrastructure.audio.curl_downloader import CurlDownloader
from src.infrastructure.audio.fallback_downloader import FallbackDownloader
from src.adapters.storage.minio_client import MinioClient

class DownloaderFactory:
    @staticmethod
    def create(url: str, minio_client: MinioClient = None) -> AudioDownloader:
        if url.startswith("minio://"):
            return MinioDownloader(minio_client)

        strategy = os.getenv("STT_DOWNLOAD_STRATEGY", "resilient").lower()

        # Define standard HTTP downloaders with fallback
        # HTTPDownloader (httpx) -> CurlDownloader (subprocess)
        http_downloaders = [
            HTTPDownloader(),
            CurlDownloader()
        ]

        if strategy == "curl":
            return CurlDownloader()

        if strategy == "http":
            return HTTPDownloader()

        # Default strategy is resilient fallback
        return FallbackDownloader(http_downloaders)
