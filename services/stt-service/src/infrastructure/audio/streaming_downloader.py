import os
import time
import asyncio
import logging
import aiohttp
import random
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, parse_qs
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Base class for download failures."""
    pass

class RetryableDownloadError(DownloadError):
    """Errors that should trigger a retry."""
    pass

class FatalDownloadError(DownloadError):
    """Errors that should NOT trigger a retry."""
    pass

class StreamingDownloader(AudioDownloader):
    def __init__(
        self,
        chunk_size: int = 65536, # 64KB
        min_file_size: int = 5 * 1024,
    ):
        self.chunk_size = chunk_size
        self.min_file_size = min_file_size

        # Realistic mobile Chrome User-Agent
        self.user_agent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"

        self.base_headers = {
            "User-Agent": self.user_agent,
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "audio",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
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
                if cookies:
                    logger.debug(f"Extracted Sipuni cookies for Range downloader: {list(cookies.keys())}")
        except Exception as e:
            logger.warning(f"Failed to extract cookies from URL: {e}")

        return cookies

    async def download(self, url: str, target_path: str) -> None:
        start_time = time.monotonic()
        cookies = self._extract_cookies(url)
        bytes_received = 0
        chunk_index = 0
        force_no_cache = False

        logger.info(f"Starting range-based download for {url}")

        try:
            with open(target_path, 'wb') as f:
                while True:
                    start_byte = bytes_received
                    end_byte = start_byte + self.chunk_size - 1
                    range_header = f"bytes={start_byte}-{end_byte}"

                    chunk_data = await self._download_chunk_with_retries(
                        url, range_header, cookies, chunk_index, force_no_cache
                    )

                    if not chunk_data:
                        # End of file reached via 416 or empty response
                        break

                    # Detect HTML in the first chunk
                    if chunk_index == 0:
                        if chunk_data.startswith(b"<!DOCTYPE html>") or chunk_data.startswith(b"<html>"):
                            raise FatalDownloadError("Downloaded HTML instead of audio")

                    await asyncio.to_thread(f.write, chunk_data)
                    received_size = len(chunk_data)
                    bytes_received += received_size

                    logger.info(
                        f"Chunk {chunk_index} received",
                        extra={
                            "chunk_index": chunk_index,
                            "range": range_header,
                            "size_received": received_size,
                            "total_bytes": bytes_received
                        }
                    )

                    if received_size < self.chunk_size:
                        # Last chunk received
                        break

                    chunk_index += 1

            if bytes_received < self.min_file_size:
                raise FatalDownloadError(f"File too small: {bytes_received} bytes")

            duration = time.monotonic() - start_time
            logger.info(
                "Range-based download successful",
                extra={
                    "url": url,
                    "duration_s": round(duration, 2),
                    "total_size_bytes": bytes_received,
                    "chunks": chunk_index + 1
                }
            )

        except Exception as e:
            logger.error(f"Range-based download failed: {e}", extra={"url": url})
            if os.path.exists(target_path):
                try: os.remove(target_path)
                except: pass
            raise

    async def _download_chunk_with_retries(
        self,
        url: str,
        range_header: str,
        cookies: Dict[str, str],
        chunk_index: int,
        force_no_cache: bool
    ) -> bytes:
        headers = self.base_headers.copy()
        headers["Range"] = range_header
        if force_no_cache:
            headers["Cache-Control"] = "no-cache"
            headers["Pragma"] = "no-cache"

        # Short timeout per chunk as requested
        timeout = aiohttp.ClientTimeout(total=10, connect=5, sock_read=5)

        max_retries = 3
        for attempt in range(max_retries + 1):
            try:
                async with aiohttp.ClientSession(headers=headers, timeout=timeout, cookies=cookies) as session:
                    async with session.get(url, allow_redirects=True) as response:
                        if response.status == 304:
                            if not force_no_cache:
                                logger.info(f"Chunk {chunk_index} returned 304, retrying with no-cache")
                                force_no_cache = True
                                headers["Cache-Control"] = "no-cache"
                                headers["Pragma"] = "no-cache"
                                continue
                            else:
                                raise FatalDownloadError("Received 304 Not Modified even with no-cache")

                        if response.status == 416:
                            # Requested range not satisfiable - usually means we reached EOF
                            return b""

                        if response.status not in (200, 206):
                            text = await response.text()
                            raise RetryableDownloadError(f"HTTP {response.status}: {text[:200]}")

                        content_type = response.headers.get("Content-Type", "").lower()
                        if chunk_index == 0 and "sipuni.com" in url:
                            if "audio" not in content_type and "octet-stream" not in content_type:
                                raise FatalDownloadError(f"Invalid Content-Type for Sipuni: {content_type}")

                        data = await response.read()

                        if attempt > 0:
                            logger.info(f"Chunk {chunk_index} succeeded after {attempt} retries")

                        return data

            except (aiohttp.ClientError, asyncio.TimeoutError, RetryableDownloadError) as e:
                retries_left = max_retries - attempt
                logger.warning(
                    f"Chunk {chunk_index} attempt {attempt+1} failed: {e}",
                    extra={
                        "chunk_index": chunk_index,
                        "attempt": attempt + 1,
                        "retries_left": retries_left,
                        "error": str(e)
                    }
                )
                if retries_left <= 0:
                    raise DownloadError(f"Failed to download chunk {chunk_index} after {max_retries} retries")

                delay = random.uniform(1, 3)
                await asyncio.sleep(delay)

        return b""
