import os
import time
import asyncio
import logging
import aiohttp
import random
from typing import Optional, Dict, Any
from urllib.parse import urlparse, parse_qs
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Base class for download failures."""
    pass

class StreamingDownloader(AudioDownloader):
    """
    A robust streaming downloader using aiohttp, designed for
    unreliable streaming endpoints like Sipuni.

    Features:
    1. True Streaming: Uses iter_chunked() to consume data as it arrives.
    2. Resumable: Uses HTTP Range headers to continue from the last downloaded byte.
    3. Persistent: Updates progress on every chunk, ensuring retries don't repeat work.
    4. Generous Timeouts: Designed to handle slow upstream audio generation.
    """
    def __init__(
        self,
        chunk_size: int = 16384,
        min_file_size: int = 5 * 1024,
        max_attempts: int = 15,
        base_backoff: float = 1.0,
        stall_timeout: float = 10.0,
    ):
        self.chunk_size = chunk_size
        self.min_file_size = min_file_size
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.stall_timeout = stall_timeout

        # Browser-like headers to avoid being blocked or throttled
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "identity;q=1, *;q=0",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }

    def _extract_cookies(self, url: str) -> Dict[str, str]:
        """Extracts cookies from URL parameters for Sipuni authentication."""
        cookies = {}
        try:
            parsed_url = urlparse(url)
            params = parse_qs(parsed_url.query)

            if "sipuni.com" in parsed_url.netloc:
                if "hash" in params:
                    cookies["hcode"] = params["hash"][0]
                if "user" in params:
                    cookies["user"] = params["user"][0]
        except Exception as e:
            logger.warning(f"Failed to extract cookies from URL: {e}")

        return cookies

    async def download(self, url: str, target_path: str, cookies: Dict[str, str] = None, extra_headers: Dict[str, str] = None) -> None:
        start_total_time = time.monotonic()
        logger.info("Starting robust streaming download", extra={"url": url, "target": target_path})

        if cookies is None:
            cookies = self._extract_cookies(url)

        temp_path = f"{target_path}.tmp"
        attempt = 0
        total_size = None

        # sock_read is generous, but we'll use manual per-chunk timeout for stall detection
        timeout = aiohttp.ClientTimeout(total=None, sock_read=600, connect=30)

        while attempt < self.max_attempts:
            attempt += 1
            attempt_start_time = time.monotonic()

            # Determine start byte for resume based on what's already on disk
            start_byte = 0
            if os.path.exists(temp_path):
                start_byte = os.path.getsize(temp_path)

            headers = self.headers.copy()
            if extra_headers:
                headers.update(extra_headers)

            # Request everything from the current offset
            headers["Range"] = f"bytes={start_byte}-"

            logger.info(f"Download attempt {attempt}/{self.max_attempts}: starting from byte {start_byte}", extra={"url": url})

            try:
                async with aiohttp.ClientSession(headers=headers, timeout=timeout, cookies=cookies) as session:
                    async with session.get(url, allow_redirects=True) as response:
                        # 416 means we already have everything (or the range is invalid)
                        if response.status == 416:
                            logger.info("Server returned 416 (Range Not Satisfiable). Assuming download is complete.", extra={"url": url})
                            break

                        if response.status not in (200, 206):
                            text = await response.text()
                            raise DownloadError(f"HTTP {response.status}: {text[:200]}")

                        # Ensure we aren't downloading an HTML error page
                        content_type = response.headers.get("Content-Type", "").lower()
                        if "text/html" in content_type:
                            raise DownloadError(f"Expected audio, got {content_type}")

                        # Extract total file size from Content-Range or Content-Length
                        content_range = response.headers.get("Content-Range")
                        if content_range and "/" in content_range:
                            try:
                                total_size = int(content_range.split("/")[-1])
                            except (ValueError, IndexError):
                                pass

                        # If server ignores Range and sends 200, we must overwrite
                        mode = "ab" if start_byte > 0 and response.status == 206 else "wb"
                        if response.status == 200:
                            if start_byte > 0:
                                logger.warning("Server ignored Range header, restarting from zero", extra={"url": url})
                            start_byte = 0
                            mode = "wb"

                        if not total_size:
                            content_length = response.headers.get("Content-Length")
                            if content_length:
                                # For 200 OK, Content-Length is the full size.
                                # For 206 Partial Content, Content-Length is only the remaining size.
                                if response.status == 206:
                                    total_size = int(content_length) + start_byte
                                else:
                                    total_size = int(content_length)

                        logger.info(f"Stream established. Total expected size: {total_size}", extra={"url": url})

                        with open(temp_path, mode) as f:
                            # The heart of the downloader: incremental streaming with stall detection
                            while True:
                                try:
                                    # Use wait_for to detect stalled connections that don't send data
                                    chunk = await asyncio.wait_for(
                                        response.content.read(self.chunk_size),
                                        timeout=self.stall_timeout
                                    )
                                except asyncio.TimeoutError:
                                    logger.warning(f"Stream stalled: no data for {self.stall_timeout}s", extra={"url": url})
                                    raise DownloadError(f"Stream stalled after {start_byte} bytes")

                                if not chunk:
                                    logger.info("End of stream reached", extra={"url": url})
                                    break

                                # Anti-HTML guard for the beginning of the file
                                if start_byte == 0 and chunk.startswith((b"<!DOCTYPE", b"<html>", b"<html")):
                                    raise DownloadError("First chunk indicates HTML content instead of audio")

                                await asyncio.to_thread(f.write, chunk)
                                start_byte += len(chunk)

                                # Progress reporting
                                if total_size:
                                    percent = (start_byte / total_size) * 100
                                    logger.info(f"Progress: {start_byte}/{total_size} bytes ({percent:.1f}%)", extra={"url": url})
                                else:
                                    logger.info(f"Progress: {start_byte} bytes", extra={"url": url})

                                # If we know the total size and we've reached it, we're done
                                if total_size and start_byte >= total_size:
                                    logger.info("Download completed (reached total size)", extra={"url": url})
                                    break

                # Check if we finished the entire file
                if total_size and start_byte < total_size:
                    raise DownloadError(f"Connection closed prematurely: {start_byte}/{total_size} bytes received")

                # If we get here, the download of the requested range (or full file) is complete
                break

            except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                duration = time.monotonic() - attempt_start_time
                logger.warning(
                    f"Attempt {attempt} failed after {duration:.1f}s at byte {start_byte}",
                    extra={"url": url, "error": str(e)}
                )

                if attempt >= self.max_attempts:
                    raise DownloadError(f"Download failed after {attempt} attempts: {str(e)}")

                # Fast retry: 1-3 seconds
                delay = random.uniform(1.0, 3.0)
                logger.info(f"Retrying in {delay:.2f}s (Attempt {attempt+1}/{self.max_attempts})...", extra={"url": url})
                await asyncio.sleep(delay)

        # Final verification of the downloaded file
        if not os.path.exists(temp_path):
            raise DownloadError("Download failed: temporary file missing")

        final_size = os.path.getsize(temp_path)
        if final_size < self.min_file_size:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise DownloadError(f"Downloaded file too small: {final_size} bytes (min: {self.min_file_size})")

        # Move to final destination
        os.replace(temp_path, target_path)

        logger.info(
            "Streaming download successful",
            extra={
                "url": url,
                "final_size": final_size,
                "total_attempts": attempt,
                "duration_s": round(time.monotonic() - start_total_time, 2)
            }
        )
