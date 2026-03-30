import os
import time
import logging
import asyncio
import httpx
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class HTTPDownloader(AudioDownloader):
    def __init__(
        self,
        max_attempts: int = 5,
        base_backoff: float = 2.0,
        chunk_size: int = 64 * 1024,  # 64KB chunks
        stall_timeout: int = 20,  # Detect stalls after 20 seconds
        min_file_size: int = 5 * 1024,  # Minimum 5KB
    ):
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.chunk_size = chunk_size
        self.stall_timeout = stall_timeout
        self.min_file_size = min_file_size

    async def download(self, url: str, target_path: str) -> None:
        attempt = 0
        while attempt < self.max_attempts:
            attempt += 1
            try:
                await self._download_with_resume(url, target_path)
                self._validate_download(target_path)
                logger.info(
                    "Download completed successfully",
                    extra={"url": url, "file_path": target_path, "attempt": attempt},
                )
                return
            except Exception as e:
                logger.warning(
                    "Download attempt failed",
                    extra={"url": url, "attempt": attempt, "error": str(e)},
                )
                if attempt == self.max_attempts:
                    raise RuntimeError(f"Failed to download after {self.max_attempts} attempts: {url}")
                backoff = self.base_backoff * (2 ** (attempt - 1))
                logger.info(f"Retrying in {backoff}s", extra={"attempt": attempt, "backoff": backoff})
                await asyncio.sleep(backoff)

    async def _download_with_resume(self, url: str, target_path: str) -> None:
        async with httpx.AsyncClient(
            http2=False,
            timeout=httpx.Timeout(60.0, connect=10.0),
            follow_redirects=True,
        ) as client:
            start_byte = os.path.getsize(target_path) if os.path.exists(target_path) else 0
            headers = {"Range": f"bytes={start_byte}-"} if start_byte > 0 else {}

            logger.info(
                "Starting download",
                extra={"url": url, "start_byte": start_byte, "headers": headers},
            )

            async with client.stream("GET", url, headers=headers) as response:
                response.raise_for_status()
                content_length = response.headers.get("content-length")
                total_size = int(content_length) + start_byte if content_length else None

                with open(target_path, "ab") as f:
                    bytes_downloaded = start_byte
                    start_time = time.monotonic()

                    async for chunk in response.aiter_bytes(self.chunk_size):
                        f.write(chunk)
                        bytes_downloaded += len(chunk)

                        # Log progress
                        logger.info(
                            "Downloading...",
                            extra={
                                "url": url,
                                "bytes_downloaded": bytes_downloaded,
                                "total_size": total_size,
                            },
                        )

                        # Detect stalls
                        if time.monotonic() - start_time > self.stall_timeout:
                            raise RuntimeError("Download stalled")

    def _validate_download(self, target_path: str) -> None:
        if not os.path.exists(target_path):
            raise RuntimeError("Downloaded file does not exist")

        file_size = os.path.getsize(target_path)
        if file_size < self.min_file_size:
            raise RuntimeError(f"Downloaded file is too small: {file_size} bytes")

        logger.info(
            "Download validation passed",
            extra={"file_path": target_path, "file_size": file_size},
        )
