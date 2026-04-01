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
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "audio",
                    "sec-fetch-mode": "no-cors",
                    "sec-fetch-site": "same-site",
                }
            )

            if cookies:
                await context.add_cookies(cookies)

            try:
                # Step 1: Request the document/html to establish any server-side session or cookies.
                # Some providers (Sipuni) respond with an HTML document on the first request which
                # sets cookies or other session state; following the document request we then
                # request the audio binary using the same context so cookies are preserved.
                doc_headers = {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                }

                try:
                    doc_response: PlaywrightResponse = await context.request.get(
                        url,
                        timeout=self.timeout_ms,
                        headers=doc_headers
                    )
                except Exception:
                    # Non-fatal: if document request fails, continue to try audio request below.
                    doc_response = None

                # If we got a document response and it looks like HTML, log it and continue.
                if doc_response and doc_response.ok:
                    ct = (doc_response.headers.get("content-type") or "").lower()
                    logger.debug(f"Playwright document response status={doc_response.status} content-type={ct}")

                # Step 2: Request audio binary using permissive audio accept headers and no-cache.
                audio_headers = {
                    "Accept": "audio/mpeg,audio/*;q=0.9,application/octet-stream;q=0.8,*/*;q=0.7",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    # browsers often request ranges — request full file; server may respond with 206
                    "Range": "bytes=0-",
                }

                response: PlaywrightResponse = await context.request.get(
                    url,
                    timeout=self.timeout_ms,
                    headers=audio_headers
                )

                if not response:
                    raise DownloadError("No response received from Playwright")

                # Accept 200 or 206 (partial content) as valid audio responses
                if response.status not in (200, 206):
                    # If we previously got a document that returned 304, prefer the audio request
                    # error message for clarity.
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
