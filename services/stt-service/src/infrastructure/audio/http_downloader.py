import os
import time
import logging
import asyncio
import httpx
from typing import Optional
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class HTTPDownloader(AudioDownloader):
    def __init__(
        self,
        max_attempts: int = 3,
        base_backoff: float = 2.0,
        chunk_size: int = 64 * 1024,  # 64KB chunks
        stall_timeout: float = 30.0,  # Read timeout for httpx
        min_file_size: int = 5 * 1024,  # Minimum 5KB
        verify_ssl: bool = True, # Configurable SSL verification
    ):
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.chunk_size = chunk_size
        self.stall_timeout = stall_timeout
        self.min_file_size = min_file_size
        self.verify_ssl = verify_ssl
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }

    async def download(self, url: str, target_path: str) -> None:
        attempt = 0
        temp_path = f"{target_path}.tmp"

        # Clean up any existing temp file from previous failed runs if not resuming
        if attempt == 0 and os.path.exists(temp_path):
             os.remove(temp_path)

        while attempt < self.max_attempts:
            attempt += 1
            try:
                start_time = time.monotonic()
                await self._download_with_resume(url, temp_path)

                self._validate_download(temp_path)

                # Atomically move temp file to final destination
                os.replace(temp_path, target_path)

                duration = time.monotonic() - start_time
                file_size = os.path.getsize(target_path)

                logger.info(
                    "HTTP Download completed successfully",
                    extra={
                        "url": url,
                        "file_path": target_path,
                        "attempt": attempt,
                        "duration_s": round(duration, 2),
                        "size_bytes": file_size,
                        "speed_kbps": round((file_size / 1024) / duration, 2) if duration > 0 else 0
                    },
                )
                return
            except Exception as e:
                logger.warning(
                    "HTTP Download attempt failed",
                    extra={
                        "url": url,
                        "attempt": attempt,
                        "error_type": type(e).__name__,
                        "error_message": str(e)
                    },
                )
                if attempt == self.max_attempts:
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                        except:
                            pass
                    raise RuntimeError(f"HTTP Failed after {self.max_attempts} attempts: {str(e)}")

                backoff = self.base_backoff * (2 ** (attempt - 1))
                logger.info(f"Retrying in {backoff}s", extra={"attempt": attempt, "backoff": backoff})
                await asyncio.sleep(backoff)

    async def _download_with_resume(self, url: str, temp_path: str) -> None:
        # Check if we can resume
        start_byte = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0
        headers = self.headers.copy()
        if start_byte > 0:
            headers["Range"] = f"bytes={start_byte}-"

        # Relying on httpx.Timeout for stall detection (read timeout)
        timeout = httpx.Timeout(
            connect=10.0,
            read=self.stall_timeout,
            write=30.0,
            pool=60.0
        )

        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            verify=self.verify_ssl
        ) as client:
            async with client.stream("GET", url, headers=headers) as response:
                # If we asked for a range but got 200, it means server doesn't support resume
                # and sent the whole file. We should truncate our temp file.
                if start_byte > 0 and response.status_code == 200:
                    logger.info("Server does not support Range, restarting download", extra={"url": url})
                    start_byte = 0
                    with open(temp_path, "wb") as f:
                        f.truncate(0)

                response.raise_for_status()

                content_length = response.headers.get("content-length")
                total_size = int(content_length) + start_byte if content_length else None

                mode = "ab" if start_byte > 0 else "wb"

                with open(temp_path, mode) as f:
                    bytes_downloaded = start_byte

                    # aiter_bytes is already async and will raise TimeoutError if no data arrives
                    async for chunk in response.aiter_bytes(self.chunk_size):
                        if not chunk:
                            continue

                        f.write(chunk)
                        bytes_downloaded += len(chunk)

                        # Progress logging (sampled to avoid log spam)
                        if bytes_downloaded % (self.chunk_size * 10) == 0:
                            logger.debug(
                                "Downloading progress",
                                extra={
                                    "url": url,
                                    "bytes_downloaded": bytes_downloaded,
                                    "total_size": total_size,
                                },
                            )

    def _validate_download(self, file_path: str) -> None:
        if not os.path.exists(file_path):
            raise RuntimeError("Downloaded file does not exist")

        file_size = os.path.getsize(file_path)
        if file_size < self.min_file_size:
            raise RuntimeError(f"Downloaded file is too small: {file_size} bytes (min: {self.min_file_size})")

        logger.info(
            "Download validation passed",
            extra={"file_path": file_path, "file_size": file_size},
        )
