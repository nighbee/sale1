import os
import time
import logging
import asyncio
from typing import Optional, Dict, List, Any
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, APIResponse as PlaywrightResponse
from src.infrastructure.audio.streaming_downloader import StreamingDownloader
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
                    # Non-fatal: if document request fails, continue to try streaming below.
                    doc_response = None

                # If we got a document response and it looks like HTML, log it and continue.
                if doc_response and doc_response.ok:
                    ct = (doc_response.headers.get("content-type") or "").lower()
                    logger.debug(f"Playwright document response status={doc_response.status} content-type={ct}")

                # Extract cookies from the Playwright context so aiohttp can reuse them.
                try:
                    raw_cookies = await context.cookies()
                    # Playwright returns a list of cookie dicts; convert to name->value mapping
                    cookies_dict = {c.get('name'): c.get('value') for c in raw_cookies if 'name' in c and 'value' in c}
                    logger.debug(f"Extracted cookies from Playwright context: {list(cookies_dict.keys())}")
                except Exception as e:
                    logger.warning(f"Failed to extract cookies from Playwright context: {e}")
                    cookies_dict = None

                # Use StreamingDownloader (aiohttp) with cookies to perform resumable streaming download.
                streaming = StreamingDownloader(
                    chunk_size=8192,
                    min_file_size=self.min_file_size,
                    max_attempts=5,
                    base_backoff=2.0,
                )

                extra_headers = {
                    "User-Agent": self.user_agent,
                    "Accept": "audio/mpeg,audio/*;q=0.9,application/octet-stream;q=0.8,*/*;q=0.7",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": url,
                    "Cache-Control": "no-cache",
                }

                try:
                    await streaming.download(url, target_path, cookies=cookies_dict, extra_headers=extra_headers)
                except Exception as e:
                    logger.warning(f"StreamingDownloader failed, attempting Playwright ranged fallback: {e}")

                    # Playwright ranged-chunk fallback: use the browser context to issue
                    # small Range requests. This helps when the server treats non-browser
                    # User-Agents differently.
                    temp_path = f"{target_path}.tmp"
                    ranged_chunk = int(os.getenv("STT_RANGED_CHUNK", str(max(8192, 64 * 1024))))
                    small_read_timeout = int(os.getenv("STT_RANGED_READ_TIMEOUT", "30"))
                    ranged_max_attempts = int(os.getenv("STT_RANGED_MAX_ATTEMPTS", "10000"))

                    start_byte = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0
                    ranged_attempt = 0
                    total_expected_size = None

                    while True:
                        ranged_attempt += 1
                        range_end = start_byte + ranged_chunk - 1
                        headers = {
                            "Accept": "audio/mpeg,audio/*;q=0.9,application/octet-stream;q=0.8,*/*;q=0.7",
                            "Range": f"bytes={start_byte}-{range_end}",
                            "Referer": url,
                            "Cache-Control": "no-cache",
                        }

                        try:
                            resp: PlaywrightResponse = await context.request.get(url, timeout=self.timeout_ms, headers=headers)
                        except Exception as ex:
                            logger.warning(f"Playwright ranged request exception: {ex}")
                            if ranged_attempt >= ranged_max_attempts:
                                raise DownloadError(f"Playwright ranged fallback failed after {ranged_attempt} attempts: {ex}")
                            await asyncio.sleep(self.base_backoff * ranged_attempt)
                            continue

                        if resp.status == 416:
                            logger.info("Playwright ranged request returned 416. Assuming complete.")
                            break

                        if resp.status not in (200, 206):
                            text = await resp.text()
                            raise DownloadError(f"Playwright ranged HTTP {resp.status}: {text[:200]}")

                        # Extract total size from Content-Range if possible
                        content_range = resp.headers.get("content-range")
                        if content_range and "/" in content_range:
                            try:
                                total_expected_size = int(content_range.split("/")[-1])
                            except (ValueError, IndexError):
                                pass

                        body = await resp.body()
                        if not body:
                            logger.debug("Playwright ranged returned empty body; stopping")
                            if total_expected_size and start_byte < total_expected_size:
                                logger.warning(f"Playwright ranged returned no data but expected more: {start_byte} < {total_expected_size}")
                                # Let it retry or fail if max attempts reached
                            break

                        # Detect HTML
                        if start_byte == 0:
                            if body.startswith(b"<!DOCTYPE html>") or body.startswith(b"<html>"):
                                raise DownloadError("Playwright fallback downloaded HTML instead of audio")

                        # Append to temp file
                        with open(temp_path, 'ab') as f:
                            f.write(body)

                        start_byte += len(body)
                        logger.info(f"Playwright ranged attempt {ranged_attempt}: wrote {len(body)} bytes, total {start_byte}, expected {total_expected_size}")

                        if resp.status == 200:
                            break

                        if total_expected_size and start_byte >= total_expected_size:
                            break

                        if ranged_attempt >= ranged_max_attempts:
                            raise DownloadError(f"Playwright ranged fallback failed after {ranged_attempt} attempts")

                    # Finalize: rename temp to target
                    if not os.path.exists(temp_path):
                        raise DownloadError("Playwright ranged fallback failed: temporary file missing")
                    os.replace(temp_path, target_path)

            finally:
                await context.close()
                await browser.close()
