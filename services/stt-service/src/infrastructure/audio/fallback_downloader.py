import logging
import os
from typing import List
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class FallbackDownloader(AudioDownloader):
    def __init__(self, downloaders: List[AudioDownloader]):
        if not downloaders:
            raise ValueError("FallbackDownloader requires at least one downloader")
        self.downloaders = downloaders

    async def download(self, url: str, target_path: str) -> None:
        last_error = None
        for i, downloader in enumerate(self.downloaders):
            downloader_name = type(downloader).__name__
            try:
                logger.info(
                    f"Attempting download with {downloader_name}",
                    extra={
                        "url": url,
                        "downloader_index": i,
                        "downloader_type": downloader_name
                    }
                )
                await downloader.download(url, target_path)
                logger.info(
                    f"Successfully downloaded using {downloader_name}",
                    extra={"url": url, "downloader_type": downloader_name}
                )
                return
            except Exception as e:
                last_error = e
                logger.warning(
                    f"{downloader_name} failed, trying next fallback if available",
                    extra={
                        "url": url,
                        "downloader_type": downloader_name,
                        "error": str(e)
                    }
                )
                # Cleanup partial files before next attempt if they exist
                if os.path.exists(target_path):
                    try:
                        os.remove(target_path)
                    except:
                        pass

        error_msg = f"All downloaders failed for {url}. Last error: {str(last_error)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from last_error
