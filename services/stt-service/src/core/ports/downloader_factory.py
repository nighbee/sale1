from src.core.ports.audio_downloader import AudioDownloader
from src.infrastructure.audio.http_downloader import HTTPDownloader
from src.infrastructure.audio.minio_downloader import MinioDownloader
from src.adapters.storage.minio_client import MinioClient

class DownloaderFactory:
    @staticmethod
    def create(url: str, minio_client: MinioClient = None) -> AudioDownloader:
        if url.startswith("minio://"):
            return MinioDownloader(minio_client)
        return HTTPDownloader()
