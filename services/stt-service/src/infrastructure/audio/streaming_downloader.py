import os
import time
import asyncio
import logging
import aiohttp
from typing import Optional, Dict, Any
from urllib.parse import urlparse, parse_qs
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Custom exception for download failures."""
    pass

class StreamingDownloader(AudioDownloader):
    def __init__(
        self,
        max_attempts: int = 15,
        base_backoff: float = 2.0,
        chunk_size: int = 64 * 1024,
        stall_timeout: float = 60.0,
        min_file_size: int = 5 * 1024,
    ):
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.chunk_size = chunk_size
        self.stall_timeout = stall_timeout
        self.min_file_size = min_file_size
        # Strict browser headers as requested
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "sec-fetch-dest": "video",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Range": "bytes=0-",  # Always start from 0
        }

    def _get_cookies(self, url: str) -> str:
        """
        Support full cookie string from environment or extract from URL params.
        """
        # 1. Check environment variable for full Cookie string
        env_cookies = os.getenv("SIPUNI_COOKIES")
        if env_cookies:
            return env_cookies

        # 2. Extract from URL (fallback for Sipuni)
        cookies = []
        try:
            parsed_url = urlparse(url)
            params = parse_qs(parsed_url.query)

            if "sipuni.com" in parsed_url.netloc:
                if "hash" in params:
                    cookies.append(f"hcode={params['hash'][0]}")
                if "user" in params:
                    cookies.append(f"user={params['user'][0]}")
        except Exception as e:
            logger.warning(f"Failed to extract cookies from URL: {e}")

        return "; ".join(cookies)

    async def download(self, url: str, target_path: str) -> None:
        attempt = 0
        cookie_string = self._get_cookies(url)
        headers = self.headers.copy()
        if cookie_string:
            headers["Cookie"] = cookie_string

        # Explicitly ensure caching headers are NOT present
        headers.pop("If-Modified-Since", None)
        headers.pop("If-None-Match", None)

        while attempt < self.max_attempts:
            attempt += 1
            start_time = time.monotonic()

            try:
                await self._do_download(url, target_path, headers)

                duration = time.monotonic() - start_time
                file_size = os.path.getsize(target_path)

                logger.info(
                    "Streaming Download successful",
                    extra={
                        "url": url,
                        "attempt": attempt,
                        "duration_s": round(duration, 2),
                        "size_bytes": file_size
                    }
                )
                return

            except Exception as e:
                duration = time.monotonic() - start_time
                logger.warning(
                    f"Streaming Attempt {attempt} failed",
                    extra={
                        "url": url,
                        "error": str(e),
                        "duration_so_far": round(duration, 2)
                    }
                )

                if attempt >= self.max_attempts:
                    raise DownloadError(f"Streaming Failed after {attempt} attempts: {str(e)}")

                backoff = min(self.base_backoff * (1.5 ** (attempt - 1)), 60.0)
                logger.info(f"Waiting {backoff:.1f}s before retry...", extra={"url": url, "next_attempt": attempt + 1})
                await asyncio.sleep(backoff)

    async def _do_download(self, url: str, target_path: str, headers: Dict[str, str]) -> None:
        timeout = aiohttp.ClientTimeout(total=None, connect=15, sock_read=self.stall_timeout)

        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            async with session.get(url, allow_redirects=True) as response:

                # Handle 304 specifically
                if response.status == 304:
                    raise DownloadError("Received 304 Not Modified - refreshing cache required")

                # Accept 200 and 206
                if response.status not in (200, 206):
                    raise DownloadError(f"HTTP {response.status}: {await response.text()}")

                content_length = response.headers.get("Content-Length")
                expected_size = int(content_length) if content_length and content_length.isdigit() else None

                bytes_received = 0

                # Use a thread for file writing to avoid blocking the event loop
                with open(target_path, 'wb') as f:
                    # Manually detect stall using wait_for on chunk reading
                    async for chunk in response.content.iter_chunked(self.chunk_size):
                        if chunk:
                            await asyncio.to_thread(f.write, chunk)
                            bytes_received += len(chunk)

                # Validation
                if bytes_received < self.min_file_size:
                    raise DownloadError(f"File too small: {bytes_received} bytes")

                if expected_size and bytes_received < expected_size:
                    raise DownloadError(f"Incomplete download: {bytes_received}/{expected_size} bytes")
