import logging
import os
import time
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
            start_time = time.monotonic()
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

                duration = time.monotonic() - start_time
                logger.info(
                    f"Successfully downloaded using {downloader_name}",
                    extra={
                        "url": url,
                        "downloader_type": downloader_name,
                        "duration_s": round(duration, 2)
                    }
                )
                return
            except Exception as e:
                last_error = e
                duration = time.monotonic() - start_time
                logger.warning(
                    f"{downloader_name} failed, trying next fallback if available",
                    extra={
                        "url": url,
                        "downloader_type": downloader_name,
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                        "duration_s": round(duration, 2)
                    }
                )
                # Cleanup partial files before next attempt if they exist
                if os.path.exists(target_path):
                    try:
                        os.remove(target_path)
                    except:
                        pass
                # Also cleanup potential temp files from HTTPDownloader
                temp_path = f"{target_path}.tmp"
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass

        error_msg = f"All downloaders failed for {url}. Last error: {str(last_error)}"
        logger.error(error_msg, extra={"url": url, "last_error": str(last_error)})
        raise RuntimeError(error_msg) from last_error
