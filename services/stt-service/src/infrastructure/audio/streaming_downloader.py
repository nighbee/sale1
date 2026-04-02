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
    A rewritten, fully resilient streaming + ranged downloader with resume support.
    Specifically designed for unreliable streaming endpoints like Sipuni.

    Fixes for streaming endpoints:
    1. Resume Support: Detects existing partial file and uses HTTP Range header to continue.
    2. Append Mode: Writes in 'ab' mode to avoid overwriting successful chunks.
    3. Proper Streaming: Uses aiohttp's iter_chunked to avoid buffering in memory.
    4. Robust Timeouts: Configured to allow slow or temporarily paused streams.
    5. Clean Retry: Retries only the remaining part of the file, not from byte 0.
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

    async def download(self, url: str, target_path: str, cookies: Dict[str, str] = None, extra_headers: Dict[str, str] = None) -> None:
        start_total_time = time.monotonic()
        attempt = 0

        # Determine cookies
        if cookies is None:
            cookies = self._extract_cookies(url)

        temp_path = f"{target_path}.tmp"

        # Configure robust timeouts as requested
        timeout = aiohttp.ClientTimeout(
            total=None,       # Allow the total download to take as long as needed
            sock_read=120,    # Allow 120s of silence (slow/paused stream)
            sock_connect=10   # Standard connection timeout
        )

        total_bytes_expected = None

        while attempt < self.max_attempts:
            attempt += 1
            attempt_start_time = time.monotonic()

            # 1. Detect existing file size for resume
            start_byte = 0
            if os.path.exists(temp_path):
                start_byte = os.path.getsize(temp_path)

            # 2. Use Range header for resume
            headers = self.headers.copy()
            if extra_headers:
                headers.update(extra_headers)

            headers["Range"] = f"bytes={start_byte}-"

            # Log attempt details
            logger.info(
                f"Download attempt {attempt}/{self.max_attempts}",
                extra={
                    "resume_offset": start_byte,
                    "url": url,
                    "temp_path": temp_path
                }
            )

            try:
                async with aiohttp.ClientSession(headers=headers, timeout=timeout, cookies=cookies) as session:
                    async with session.get(url, allow_redirects=True) as response:
                        # Handle completion based on 416 (Range Not Satisfiable)
                        if response.status == 416:
                            logger.info("Server returned 416: Download already complete or range invalid.")
                            break

                        if response.status not in (200, 206):
                            text = await response.text()
                            raise DownloadError(f"HTTP {response.status}: {text[:200]}")

                        # 5. Completion detection: total size
                        content_range = response.headers.get("Content-Range")
                        if content_range and "/" in content_range:
                            try:
                                total_bytes_expected = int(content_range.split("/")[-1])
                            except (ValueError, IndexError):
                                pass

                        if total_bytes_expected is None:
                            content_length = response.headers.get("Content-Length")
                            if content_length and content_length.isdigit():
                                # For 206, Content-Length is the size of the PART, not the whole file
                                if response.status == 206:
                                    total_bytes_expected = start_byte + int(content_length)
                                else:
                                    total_bytes_expected = int(content_length)

                        # Validate Content-Type (avoid HTML)
                        content_type = response.headers.get("Content-Type", "").lower()
                        if "text/html" in content_type:
                            raise DownloadError(f"Expected audio, got {content_type}")

                        # 3. Streaming download with 2. Append mode
                        # Use 'ab' to append to existing partial data
                        with open(temp_path, "ab") as f:
                            bytes_in_this_attempt = 0
                            # iter_chunked for no buffering
                            async for chunk in response.content.iter_chunked(self.chunk_size):
                                if chunk:
                                    # Security check for HTML on fresh start
                                    if start_byte == 0 and bytes_in_this_attempt == 0:
                                        if chunk.startswith(b"<!DOCTYPE html>") or chunk.startswith(b"<html>"):
                                            raise DownloadError("First chunk indicates HTML content")

                                    await asyncio.to_thread(f.write, chunk)
                                    bytes_in_this_attempt += len(chunk)

                                    current_total = start_byte + bytes_in_this_attempt
                                    if total_bytes_expected and current_total >= total_bytes_expected:
                                        logger.info(f"Reached total size: {current_total}/{total_bytes_expected}")
                                        break

                # Check if we are actually done
                final_size_so_far = os.path.getsize(temp_path)
                if total_bytes_expected and final_size_so_far < total_bytes_expected:
                    raise DownloadError(f"Incomplete download: {final_size_so_far}/{total_bytes_expected} bytes")

                # If we reached here without exception, the download is likely finished
                break

            except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                attempt_duration = time.monotonic() - attempt_start_time
                current_size = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0

                logger.warning(
                    f"Attempt {attempt} failed: {str(e)}",
                    extra={
                        "attempt": attempt,
                        "duration": round(attempt_duration, 2),
                        "bytes_downloaded_so_far": current_size,
                        "total_expected": total_bytes_expected,
                        "error_type": type(e).__name__
                    }
                )

                if attempt >= self.max_attempts:
                    raise DownloadError(f"Download failed after {attempt} attempts: {str(e)}")

                # 4. Robust retry logic: exponential backoff
                delay = self.base_backoff * (2 ** (attempt - 1)) + random.uniform(0, 1)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)

        # Final validations
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
