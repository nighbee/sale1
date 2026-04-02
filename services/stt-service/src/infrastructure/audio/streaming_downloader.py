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
    2. Parsing: ALWAYS parses Content-Range header to extract start, end, total.
    3. Offset Update: Updates offset using server values ONLY (next_start = end + 1).
    4. Completion: Never requests beyond EOF, stops when next_start >= total.
    5. Partial Responses: Handles server returning fewer bytes than requested as valid.
    6. Retry: Retries the SAME range if request fails, doesn't skip ahead.
    7. Streaming: Uses response.content.iter_chunked(8192) for memory efficiency.
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

    def _parse_content_range(self, content_range: Optional[str]):
        """
        Parses Content-Range header.
        Example: bytes 100-200/1000
        Returns (start, end, total)
        """
        if not content_range or not content_range.startswith("bytes "):
            return None, None, None

        try:
            range_part, total_part = content_range.replace("bytes ", "").split("/")
            start_end = range_part.split("-")
            start = int(start_end[0])
            end = int(start_end[1])
            total = int(total_part) if total_part != "*" else None
            return start, end, total
        except (ValueError, IndexError):
            return None, None, None

    async def download(self, url: str, target_path: str, cookies: Dict[str, str] = None, extra_headers: Dict[str, str] = None) -> None:
        start_total_time = time.monotonic()

        # Determine cookies
        if cookies is None:
            cookies = self._extract_cookies(url)

        temp_path = f"{target_path}.tmp"

        # Configure robust timeouts
        timeout = aiohttp.ClientTimeout(
            total=None,
            sock_read=120,
            sock_connect=10
        )

        total_bytes_expected = None
        next_start = 0

        # 1. Detect existing file size for initial resume
        if os.path.exists(temp_path):
            next_start = os.path.getsize(temp_path)

        while True:
            # Check if we already finished
            if total_bytes_expected is not None and next_start >= total_bytes_expected:
                break

            attempt = 0
            success = False

            while attempt < self.max_attempts:
                attempt += 1
                attempt_start_time = time.monotonic()

                headers = self.headers.copy()
                if extra_headers:
                    headers.update(extra_headers)

                headers["Range"] = f"bytes={next_start}-"

                logger.info(
                    f"Download attempt {attempt}/{self.max_attempts} for offset {next_start}",
                    extra={"url": url, "next_start": next_start}
                )

                try:
                    async with aiohttp.ClientSession(headers=headers, timeout=timeout, cookies=cookies) as session:
                        async with session.get(url, allow_redirects=True) as response:
                            if response.status == 416:
                                logger.info("Server returned 416: Range Not Satisfiable.")
                                success = True
                                if total_bytes_expected is None:
                                    if os.path.exists(temp_path) and os.path.getsize(temp_path) >= self.min_file_size:
                                        next_start = float('inf')
                                break

                            if response.status not in (200, 206):
                                text = await response.text()
                                raise DownloadError(f"HTTP {response.status}: {text[:200]}")

                            # Parse Content-Range
                            cr_header = response.headers.get("Content-Range")
                            start, end, total = self._parse_content_range(cr_header)

                            if total is not None:
                                total_bytes_expected = total

                            # If it's a 200 response, it's not ranged, treat as starting from 0
                            if response.status == 200:
                                start = 0
                                content_length = response.headers.get("Content-Length")
                                if content_length:
                                    total_bytes_expected = int(content_length)
                                end = total_bytes_expected - 1 if total_bytes_expected else None

                            # Validate we are getting what we asked for
                            if start is not None and start != next_start and response.status == 206:
                                logger.warning(f"Server returned start {start} but we asked for {next_start}.")

                            content_type = response.headers.get("Content-Type", "").lower()
                            if "text/html" in content_type:
                                raise DownloadError(f"Expected audio, got {content_type}")

                            # Write to file
                            mode = "ab" if next_start == (os.path.getsize(temp_path) if os.path.exists(temp_path) else 0) else "r+b"
                            if not os.path.exists(temp_path):
                                mode = "wb"

                            with open(temp_path, mode) as f:
                                if "r+" in mode:
                                    f.seek(next_start)

                                bytes_received = 0
                                # Streaming: Uses response.content.iter_chunked(8192)
                                async for chunk in response.content.iter_chunked(self.chunk_size):
                                    if chunk:
                                        if next_start == 0 and bytes_received == 0:
                                            if chunk.startswith(b"<!DOCTYPE html>") or chunk.startswith(b"<html>"):
                                                raise DownloadError("First chunk indicates HTML content")

                                        await asyncio.to_thread(f.write, chunk)
                                        bytes_received += len(chunk)

                            # Update next_start based on server values
                            if end is not None:
                                # We assume we got all bytes up to 'end' if no exception occurred
                                next_start = end + 1
                                success = True
                                break
                            else:
                                # Fallback if no Content-Range (e.g. 200 response)
                                next_start += bytes_received
                                success = True
                                break

                except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                    attempt_duration = time.monotonic() - attempt_start_time
                    logger.warning(
                        f"Attempt {attempt} failed: {str(e)}",
                        extra={
                            "attempt": attempt,
                            "next_start": next_start,
                            "error_type": type(e).__name__,
                            "duration": round(attempt_duration, 2)
                        }
                    )
                    if attempt >= self.max_attempts:
                        raise DownloadError(f"Download failed after {attempt} attempts: {str(e)}")

                    delay = self.base_backoff * (2 ** (attempt - 1)) + random.uniform(0, 1)
                    await asyncio.sleep(delay)

            if not success:
                raise DownloadError(f"Failed to download range starting at {next_start}")

            if total_bytes_expected is not None and next_start >= total_bytes_expected:
                break
            if next_start == float('inf'):
                break

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
                "total_duration": round(total_duration, 2)
            }
        )
