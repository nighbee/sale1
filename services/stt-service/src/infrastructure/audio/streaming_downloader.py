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

    Why this works:
    1. True Streaming: It uses iter_chunked() to consume the response body
       incrementally, avoiding memory issues and handled paused streams.
    2. Socket Timeouts: specifically handles sock_read timeouts to allow
       long pauses common in streaming servers.
    3. Resilience: Implements exponential backoff and Range-based resume
       to survive intermittent connection drops.
    4. Validations: Checks for HTML content and minimum file size to
       avoid saving error pages or truncated files.
    """
    def __init__(
        self,
        chunk_size: int = 8192,
        min_file_size: int = 5 * 1024,
        max_attempts: int = 5,
        base_backoff: float = 2.0,
    ):
        self.chunk_size = chunk_size
        self.min_file_size = min_file_size
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff

        # Minimal headers as requested
        self.headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
        }

    def _extract_cookies(self, url: str) -> Dict[str, str]:
        """
        Extracts cookies from URL parameters for specific providers like Sipuni.
        Sipuni uses 'hash' as 'hcode' cookie and 'user' as 'user' cookie.
        """
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

    async def download(self, url: str, target_path: str, cookies: Dict[str, str] = None) -> None:
        start_total_time = time.monotonic()
        attempt = 0
        # Allow caller-provided cookies (from Playwright) to override URL-extracted cookies
        if cookies is None:
            cookies = self._extract_cookies(url)
        temp_path = f"{target_path}.tmp"

        # Long timeout for slow/paused streams (sock_read=120)
        timeout = aiohttp.ClientTimeout(total=None, sock_read=120, connect=30)

        while attempt < self.max_attempts:
            attempt += 1
            attempt_start_time = time.monotonic()
            bytes_in_this_attempt = 0

            # Determine if we can resume
            start_byte = 0
            if os.path.exists(temp_path):
                start_byte = os.path.getsize(temp_path)

            headers = self.headers.copy()
            if start_byte > 0:
                headers["Range"] = f"bytes={start_byte}-"
                mode = "ab"
                logger.info(f"Download attempt {attempt}: Resuming from {start_byte} bytes")
            else:
                headers["Range"] = "bytes=0-"
                mode = "wb"
                logger.info(f"Download attempt {attempt}: Starting fresh")

            try:
                async with aiohttp.ClientSession(headers=headers, timeout=timeout, cookies=cookies) as session:
                    async with session.get(url, allow_redirects=True) as response:
                        # Validation: HTTP status
                        if response.status == 416:
                            # Requested range not satisfiable - might be already finished
                            logger.info("Server returned 416 (Range Not Satisfiable). Assuming download is complete.")
                            break

                        if response.status not in (200, 206):
                            text = await response.text()
                            raise DownloadError(f"HTTP {response.status}: {text[:200]}")

                        # Validation: Content-Type
                        content_type = response.headers.get("Content-Type", "").lower()
                        if "text/html" in content_type:
                            raise DownloadError(f"Expected audio, got {content_type}")

                        # Write stream to file
                        with open(temp_path, mode) as f:
                            async for chunk in response.content.iter_chunked(self.chunk_size):
                                if chunk:
                                    # Detection of HTML in first chunk
                                    if start_byte == 0 and bytes_in_this_attempt == 0:
                                        if chunk.startswith(b"<!DOCTYPE html>") or chunk.startswith(b"<html>"):
                                            raise DownloadError("First chunk indicates HTML content")

                                    await asyncio.to_thread(f.write, chunk)
                                    bytes_in_this_attempt += len(chunk)

                attempt_duration = time.monotonic() - attempt_start_time
                logger.info(
                    f"Attempt {attempt} finished",
                    extra={
                        "attempt": attempt,
                        "duration": round(attempt_duration, 2),
                        "bytes_downloaded": bytes_in_this_attempt,
                        "total_bytes_so_far": os.path.getsize(temp_path)
                    }
                )

                # If we made it through the stream without exception, we're done
                break

            except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                attempt_duration = time.monotonic() - attempt_start_time
                logger.warning(
                    f"Attempt {attempt} failed",
                    extra={
                        "attempt": attempt,
                        "duration": round(attempt_duration, 2),
                        "bytes_downloaded": bytes_in_this_attempt,
                        "error": str(e)
                    }
                )

                if attempt >= self.max_attempts:
                    if os.path.exists(temp_path):
                        try: os.remove(temp_path)
                        except: pass
                    raise DownloadError(f"Download failed after {attempt} attempts: {str(e)}")

                # Exponential backoff
                delay = self.base_backoff * (2 ** (attempt - 1)) + random.uniform(0, 1)
                await asyncio.sleep(delay)

        # Post-download validations
        if not os.path.exists(temp_path):
            raise DownloadError("Download failed: temporary file missing")

        final_size = os.path.getsize(temp_path)
        if final_size < self.min_file_size:
            try: os.remove(temp_path)
            except: pass
            raise DownloadError(f"Downloaded file too small ({final_size} bytes), minimum is {self.min_file_size}")

        # Finalize
        os.replace(temp_path, target_path)

        total_duration = time.monotonic() - start_total_time
        logger.info(
            "Streaming download complete",
            extra={
                "url": url,
                "target": target_path,
                "final_size": final_size,
                "total_attempts": attempt,
                "total_duration": round(total_duration, 2)
            }
        )
