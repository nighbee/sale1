import os
from src.core.ports.audio_downloader import AudioDownloader
from src.infrastructure.audio.http_downloader import HTTPDownloader
from src.infrastructure.audio.minio_downloader import MinioDownloader
from src.infrastructure.audio.curl_downloader import CurlDownloader
from src.adapters.storage.minio_client import MinioClient

class DownloaderFactory:
    @staticmethod
    def create(url: str, minio_client: MinioClient = None) -> AudioDownloader:
        if url.startswith("minio://"):
            return MinioDownloader(minio_client)

        # Force curl for Sipuni as it is more robust for their streaming endpoint
        if "sipuni.com" in url.lower():
            return HTTPDownloader()

        strategy = os.getenv("STT_DOWNLOAD_STRATEGY", "http").lower()
        if strategy == "curl":
            return HTTPDownloader()

        return HTTPDownloader()
