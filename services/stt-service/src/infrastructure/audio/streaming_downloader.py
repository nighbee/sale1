import os
import time
import asyncio
import logging
import aiohttp
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
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
        max_attempts: int = 15,
        base_backoff: float = 2.0,
        chunk_size: int = 64 * 1024,
        stall_timeout: float = 60.0,
        min_file_size: int = 1 * 1024,
    ):
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.chunk_size = chunk_size
        self.stall_timeout = stall_timeout
        self.min_file_size = min_file_size
        # Strict browser headers
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "sec-fetch-dest": "video",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Range": "bytes=0-",  # Always start from 0
        }

    async def _get_sipuni_session_cookies(self, url: str) -> str:
        """
        Use Playwright to warm up the session and extract all cookies.
        """
        if "sipuni.com" not in url:
            return ""

        logger.info(f"Warming up Sipuni session for URL: {url}")
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(user_agent=self.headers["User-Agent"])
                page = await context.new_page()

                # Navigate to the URL to trigger cookie setting
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(2)

                cookies = await context.cookies()
                await browser.close()

                cookie_str = "; ".join([f"{c['name']}={c['value']}" for c in cookies])
                logger.info(f"Extracted {len(cookies)} cookies from Playwright session")

                return cookie_str
        except Exception as e:
            if "Executable doesn't exist" in str(e):
                logger.warning("Playwright browser not found, skipping session warming (using fallback logic)")
            else:
                logger.error(f"Playwright session warming failed: {e}")
            return ""

    def _get_url_cookies(self, url: str) -> str:
        """
        Extract cookies from URL parameters as a fallback.
        """
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
        cookie_string = ""

        while attempt < self.max_attempts:
            attempt += 1
            start_time = time.monotonic()

            # Refresh cookies every few attempts or if missing
            if not cookie_string or attempt % 5 == 1:
                cookie_string = await self._get_sipuni_session_cookies(url)
                if not cookie_string:
                    cookie_string = self._get_url_cookies(url)

                env_cookies = os.getenv("SIPUNI_COOKIES")
                if env_cookies:
                    cookie_string = env_cookies

            headers = self.headers.copy()
            if cookie_string:
                headers["Cookie"] = cookie_string

            # Explicitly ensure caching headers are NOT present
            headers.pop("If-Modified-Since", None)
            headers.pop("If-None-Match", None)

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

            except (aiohttp.ClientError, asyncio.TimeoutError, RetryableDownloadError) as e:
                # Retry on network errors, timeouts, or specific retryable errors (304, stall)
                duration = time.monotonic() - start_time
                error_msg = str(e)

                logger.warning(
                    f"Streaming Attempt {attempt} failed (Retryable)",
                    extra={
                        "url": url,
                        "error": error_msg,
                        "duration_so_far": round(duration, 2)
                    }
                )

                if attempt >= self.max_attempts:
                    raise DownloadError(f"Streaming Failed after {attempt} attempts: {error_msg}")

                backoff = min(self.base_backoff * (1.5 ** (attempt - 1)), 60.0)
                logger.info(f"Waiting {backoff:.1f}s before retry...", extra={"url": url, "next_attempt": attempt + 1})
                await asyncio.sleep(backoff)
            except Exception as e:
                # Fatal error or non-retryable DownloadError
                logger.error(f"Streaming Fatal Error on attempt {attempt}: {e}", extra={"url": url})
                raise

    async def _do_download(self, url: str, target_path: str, headers: Dict[str, str]) -> None:
        timeout = aiohttp.ClientTimeout(total=None, connect=30, sock_read=None)

        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            async with session.get(url, allow_redirects=True) as response:

                if response.status == 304:
                    raise RetryableDownloadError("Received 304 Not Modified")

                if response.status not in (200, 206):
                    text = await response.text()
                    raise FatalDownloadError(f"HTTP {response.status}: {text[:200]}")

                content_length = response.headers.get("Content-Length")
                expected_size = int(content_length) if content_length and content_length.isdigit() else None

                bytes_received = 0
                last_log_time = time.monotonic()

                with open(target_path, 'wb') as f:
                    try:
                        while True:
                            chunk = await asyncio.wait_for(
                                response.content.read(self.chunk_size),
                                timeout=self.stall_timeout
                            )
                            if not chunk:
                                break

                            await asyncio.to_thread(f.write, chunk)
                            bytes_received += len(chunk)

                            # Log progress every 5 seconds
                            now = time.monotonic()
                            if now - last_log_time > 5.0:
                                logger.info(f"Download progress: {bytes_received} bytes received", extra={"url": url})
                                last_log_time = now

                    except asyncio.TimeoutError:
                        raise RetryableDownloadError(f"Stream stalled: no data for {self.stall_timeout}s")

                if bytes_received < self.min_file_size:
                    if os.path.exists(target_path):
                        with open(target_path, 'rb') as f:
                            head = f.read(1024)
                            if b"<!DOCTYPE html>" in head or b"<html" in head:
                                raise FatalDownloadError("Downloaded HTML instead of audio")
                    raise FatalDownloadError(f"File too small: {bytes_received} bytes")

                if expected_size and bytes_received < expected_size:
                    raise RetryableDownloadError(f"Incomplete download: {bytes_received}/{expected_size} bytes")
