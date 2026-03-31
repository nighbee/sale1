import os
import time
import logging
import asyncio
from typing import Optional, Dict, List, Any
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, APIResponse as PlaywrightResponse
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Custom exception for download failures."""
    pass

class PlaywrightDownloader(AudioDownloader):
    def __init__(
        self,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        timeout_ms: int = 60000,
        max_attempts: int = 3,
        base_backoff: float = 2.0,
        min_file_size: int = 5 * 1024,
    ):
        self.user_agent = user_agent
        self.timeout_ms = timeout_ms
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.min_file_size = min_file_size

    def _extract_cookies(self, url: str) -> List[Dict[str, str]]:
        """
        Extracts cookies from URL parameters for specific providers like Sipuni.
        Sipuni uses 'hash' as 'hcode' cookie and 'user' as 'user' cookie.
        """
        cookies = []
        try:
            parsed_url = urlparse(url)
            params = parse_qs(parsed_url.query)

            if "sipuni.com" in parsed_url.netloc:
                domain = "sipuni.com"
                if "hash" in params:
                    cookies.append({"name": "hcode", "value": params["hash"][0], "domain": domain, "path": "/"})
                if "user" in params:
                    cookies.append({"name": "user", "value": params["user"][0], "domain": domain, "path": "/"})
                logger.debug(f"Extracted Sipuni cookies for Playwright: {len(cookies)}")
        except Exception as e:
            logger.warning(f"Failed to extract cookies from URL for Playwright: {e}")

        return cookies

    async def download(self, url: str, target_path: str) -> None:
        """
        Download an audio file using Playwright's async API.
        """
        attempt = 0
        cookies = self._extract_cookies(url)

        while attempt < self.max_attempts:
            attempt += 1
            start_time = time.monotonic()

            try:
                await self._do_download(url, target_path, cookies)

                duration = time.monotonic() - start_time
                file_size = os.path.getsize(target_path)

                logger.info(
                    "Playwright Download successful",
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
                    f"Playwright Attempt {attempt} failed",
                    extra={
                        "url": url,
                        "error": str(e),
                        "duration_so_far": round(duration, 2)
                    }
                )

                if attempt >= self.max_attempts:
                    raise DownloadError(f"Playwright Failed after {attempt} attempts: {str(e)}")

                backoff = self.base_backoff * (2 ** (attempt - 1))
                logger.info(f"Waiting {backoff}s before retry...", extra={"url": url, "next_attempt": attempt + 1})
                await asyncio.sleep(backoff)

    async def _do_download(self, url: str, target_path: str, cookies: List[Dict]) -> None:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.user_agent,
                viewport={'width': 1920, 'height': 1080},
                extra_http_headers={
                    "Accept": "audio/mpeg,audio/*;q=0.9,application/octet-stream;q=0.8,*/*;q=0.7",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                }
            )

            if cookies:
                await context.add_cookies(cookies)

            try:
                # Use context.request for binary data
                # By using a fresh context and NOT providing If-None-Match/If-Modified-Since
                # in the request or context headers, they should be omitted.
                response: PlaywrightResponse = await context.request.get(
                    url,
                    timeout=self.timeout_ms
                )

                if not response:
                    raise DownloadError("No response received from Playwright")

                if response.status == 304:
                    raise DownloadError("Received 304 Not Modified - cached response is not acceptable")

                if response.status != 200:
                    raise DownloadError(f"HTTP {response.status}")

                body = await response.body()

                if len(body) < self.min_file_size:
                    raise DownloadError(f"File too small: {len(body)} bytes")

                # Basic binary check to avoid HTML
                if body.startswith(b"<!DOCTYPE html>") or body.startswith(b"<html>"):
                     raise DownloadError("Downloaded HTML instead of audio")

                # Write to file
                with open(target_path, 'wb') as f:
                    f.write(body)

            finally:
                await context.close()
                await browser.close()
