import os
import time
import logging
import asyncio
import httpx
from typing import Optional, Dict, Any
from urllib.parse import urlparse, parse_qs
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Custom exception for download-specific failures."""
    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(message)
        self.details = details or {}

class HTTPDownloader(AudioDownloader):
    def __init__(
        self,
        max_attempts: int = 3,
        base_backoff: float = 2.0,
        chunk_size: int = 64 * 1024,  # 64KB chunks
        stall_timeout: float = 30.0,  # Read timeout for httpx
        min_file_size: int = 5 * 1024,  # Minimum 5KB
        verify_ssl: bool = True,
    ):
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.chunk_size = chunk_size
        self.stall_timeout = stall_timeout
        self.min_file_size = min_file_size
        self.verify_ssl = verify_ssl
        # Enhanced headers to mimic a real browser/media player
        self.headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
            "Accept": "*/*",
            "Accept-Encoding": "identity;q=1, *;q=0",
            "Connection": "keep-alive",
            "sec-fetch-dest": "video",
            "sec-fetch-mode": "no-cors",
            "sec-fetch-site": "cross-site",
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

            # Sipuni specific mapping
            if "sipuni.com" in parsed_url.netloc:
                if "hash" in params:
                    cookies["hcode"] = params["hash"][0]
                if "user" in params:
                    cookies["user"] = params["user"][0]
                logger.debug(f"Extracted Sipuni cookies: {list(cookies.keys())}")
        except Exception as e:
            logger.warning(f"Failed to extract cookies from URL: {e}")

        return cookies

    async def download(self, url: str, target_path: str) -> None:
        """
        Download with pre-flight check, resume support, and smart validation.
        Uses a persistent session to handle cookies and state.
        """
        attempt = 0
        temp_path = f"{target_path}.tmp"
        
        cookies = self._extract_cookies(url)
        timeout = httpx.Timeout(self.stall_timeout, connect=15.0, read=self.stall_timeout)

        async with httpx.AsyncClient(
            verify=self.verify_ssl,
            timeout=timeout,
            follow_redirects=True,
            cookies=cookies,
            headers=self.headers
        ) as client:
            
            # Pre-flight check
            metadata = await self._preflight(client, url)
            content_length = metadata.get("Content-Length")
            content_type = metadata.get("Content-Type", "")
            accept_ranges = metadata.get("Accept-Ranges") == "bytes"

            while attempt < self.max_attempts:
                attempt += 1
                start_time = time.monotonic()
                bytes_received = 0
                
                try:
                    # Decide if we can resume
                    can_resume = accept_ranges and os.path.exists(temp_path)
                    if attempt == 1 and not can_resume:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)

                    bytes_received = await self._download_chunked(client, url, temp_path, can_resume)

                    duration = time.monotonic() - start_time
                    self._validate_download(temp_path, content_length, content_type)

                    # Finalize
                    os.replace(temp_path, target_path)
                    file_size = os.path.getsize(target_path)

                    logger.info(
                        "HTTP Download successful",
                        extra={
                            "url": url,
                            "attempt": attempt,
                            "duration_s": round(duration, 2),
                            "size_bytes": file_size,
                            "resumed": can_resume,
                            "content_type": content_type
                        }
                    )
                    return

                except Exception as e:
                    duration = time.monotonic() - start_time
                    logger.warning(
                        f"HTTP Attempt {attempt} failed",
                        extra={
                            "url": url,
                            "error": str(e),
                            "duration_so_far": round(duration, 2),
                            "bytes_received": bytes_received
                        }
                    )

                    if attempt >= self.max_attempts:
                        if os.path.exists(temp_path):
                            try: os.remove(temp_path)
                            except: pass
                        raise DownloadError(f"HTTP Failed after {attempt} attempts: {str(e)}")

                    backoff = self.base_backoff * (2 ** (attempt - 1))
                    # Add extra delay if it looks like a generation stall
                    if isinstance(e, (httpx.ReadTimeout, httpx.PoolTimeout)):
                        backoff += 5.0

                    logger.info(f"Waiting {backoff}s before retry...", extra={"url": url, "next_attempt": attempt + 1})
                    await asyncio.sleep(backoff)

    async def _preflight(self, client: httpx.AsyncClient, url: str) -> Dict[str, str]:
        """Perform HEAD request to get metadata using the existing client."""
        try:
            resp = await client.head(url)
            # If 405 Method Not Allowed or other error, try a limited GET
            if resp.status_code != 200:
                resp = await client.get(url, headers={"Range": "bytes=0-0"})
                if resp.status_code not in (200, 206):
                    return {}

            return {k.title(): v.lower() for k, v in resp.headers.items()}
        except Exception as e:
            logger.debug(f"Pre-flight failed for {url}: {str(e)}")
            return {}

    async def _download_chunked(self, client: httpx.AsyncClient, url: str, path: str, resume: bool) -> int:
        start_byte = os.path.getsize(path) if resume and os.path.exists(path) else 0
        headers = {}
        if start_byte > 0:
            headers["Range"] = f"bytes={start_byte}-"
        else:
            # Explicitly ask for full range if not resuming, helps some media servers
            headers["Range"] = "bytes=0-"

        async with client.stream("GET", url, headers=headers) as response:
            if start_byte > 0 and response.status_code != 206:
                logger.info("Server ignored Range request, restarting...", extra={"url": url})
                start_byte = 0
                mode = "wb"
            else:
                mode = "ab" if start_byte > 0 else "wb"

            # Handle 304 Not Modified
            if response.status_code == 304:
                logger.info("Server returned 304 Not Modified", extra={"url": url})
                return start_byte

            response.raise_for_status()

            total_bytes = start_byte
            # Use a thread for file writing to avoid blocking the event loop
            with open(path, mode) as f:
                async for chunk in response.aiter_bytes(self.chunk_size):
                    if chunk:
                        await asyncio.to_thread(f.write, chunk)
                        total_bytes += len(chunk)

            return total_bytes

    def _validate_download(self, path: str, expected_size: Optional[str], content_type: str = "") -> None:
        if not os.path.exists(path):
            raise DownloadError("Final file missing")
            
        actual_size = os.path.getsize(path)
        if actual_size < self.min_file_size:
            raise DownloadError(f"File too small: {actual_size} bytes")

        # Strict Content-Type check to avoid HTML
        if "text/html" in content_type:
            raise DownloadError(f"Downloaded HTML instead of audio: Content-Type is {content_type}")

        if expected_size and expected_size.isdigit():
            expected_val = int(expected_size)
            # Allow some tolerance for streaming/compression differences if not exact
            if actual_size < expected_val:
                raise DownloadError(f"Incomplete file: {actual_size}/{expected_val} bytes")

        # Basic MPEG check (MP3 starts with 0xFF 0xFB or "ID3")
        with open(path, "rb") as f:
            header = f.read(4)
            if not (header.startswith(b"ID3") or header.startswith(b"\xff\xfb") or header.startswith(b"\xff\xf3") or header.startswith(b"RIFF")):
                # We log warning but don't fail unless strictly MP3 required
                logger.warning(f"Audio header validation: unexpected sequence {header.hex().upper()} for file {path}")
