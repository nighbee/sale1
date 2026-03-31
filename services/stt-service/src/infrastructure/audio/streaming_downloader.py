import os
import time
import asyncio
import logging
import aiohttp
from typing import Optional, Dict, List, Any
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
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
        # Strict browser headers
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "sec-fetch-dest": "video",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Range": "bytes=0-",
        }

    async def _get_warmed_cookies(self, url: str) -> str:
        """
        Visits the Sipuni URL with Playwright to 'warm up' the session
        and extract all browser-validated cookies (like PHPSESSID).
        """
        if "sipuni.com" not in url:
            return ""

        logger.info("Warming up Sipuni session via Playwright...", extra={"url": url})
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                # Mimic a real browser session
                context = await browser.new_context(
                    user_agent=self.headers["User-Agent"],
                    viewport={'width': 1280, 'height': 720}
                )
                page = await context.new_page()

                # Navigate to establish the session.
                # We expect this to either load the media or redirect.
                # Use a timeout because we only need the cookies, not the whole file.
                try:
                    await page.goto(url, wait_until="commit", timeout=15000)
                except Exception as e:
                    logger.debug(f"Session warming goto finished with: {e}")

                cookies = await context.cookies()
                await browser.close()

                cookie_pairs = [f"{c['name']}={c['value']}" for c in cookies]
                cookie_str = "; ".join(cookie_pairs)

                if cookie_str:
                    logger.info(f"Extracted {len(cookies)} cookies from warming session", extra={"url": url})
                return cookie_str
        except Exception as e:
            logger.warning(f"Session warming failed: {e}. Falling back to basic cookie extraction.", extra={"url": url})
            return ""

    def _get_basic_cookies(self, url: str) -> str:
        """Fallback for extraction from URL parameters."""
        env_cookies = os.getenv("SIPUNI_COOKIES")
        if env_cookies:
            return env_cookies

        cookies = []
        try:
            parsed_url = urlparse(url)
            params = parse_qs(parsed_url.query)
            if "sipuni.com" in parsed_url.netloc:
                if "hash" in params:
                    cookies.append(f"hcode={params['hash'][0]}")
                if "user" in params:
                    cookies.append(f"user={params['user'][0]}")
        except Exception:
            pass
        return "; ".join(cookies)

    async def download(self, url: str, target_path: str) -> None:
        attempt = 0

        # 1. Warm session for Sipuni
        warmed_cookies = await self._get_warmed_cookies(url)

        # 2. Prepare headers
        headers = self.headers.copy()
        basic_cookies = self._get_basic_cookies(url)

        # Combine cookies, preferring warmed ones
        if warmed_cookies:
            headers["Cookie"] = warmed_cookies
        elif basic_cookies:
            headers["Cookie"] = basic_cookies

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
        # total=None to prevent global timeout, sock_read for stall detection
        timeout = aiohttp.ClientTimeout(total=None, connect=15, sock_read=self.stall_timeout)

        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            async with session.get(url, allow_redirects=True) as response:

                if response.status == 304:
                    raise DownloadError("Received 304 Not Modified - refreshing cache required")

                if response.status not in (200, 206):
                    raise DownloadError(f"HTTP {response.status}: {await response.text()}")

                content_length = response.headers.get("Content-Length")
                expected_size = int(content_length) if content_length and content_length.isdigit() else None

                bytes_received = 0
                with open(target_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(self.chunk_size):
                        if chunk:
                            await asyncio.to_thread(f.write, chunk)
                            bytes_received += len(chunk)

                if bytes_received < self.min_file_size:
                    raise DownloadError(f"File too small: {bytes_received} bytes")

                if expected_size and bytes_received < expected_size:
                    raise DownloadError(f"Incomplete download: {bytes_received}/{expected_size} bytes")
