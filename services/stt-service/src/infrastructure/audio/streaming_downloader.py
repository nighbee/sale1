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
    A robust streaming downloader using aiohttp, designed for
    unreliable streaming endpoints like Sipuni.

    Why this works:
    1. True Streaming: It uses iter_chunked() to consume the response body
       incrementally, avoiding memory issues and handled paused streams.
    2. Socket Timeouts: specifically handles sock_read timeouts to allow
       long pauses common in streaming servers.
    3. Resilience: Implements exponential backoff and Range-based resume
       to survive intermittent connection drops.
    4. Validations: Checks for HTML content and minimum file size to
       avoid saving error pages or truncated files.
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
        except Exception as e:
            logger.warning(f"Failed to extract cookies from URL: {e}")

        return cookies

    async def download(self, url: str, target_path: str, cookies: Dict[str, str] = None, extra_headers: Dict[str, str] = None) -> None:
        start_total_time = time.monotonic()
        attempt = 0
        # Allow caller-provided cookies (from Playwright) to override URL-extracted cookies
        if cookies is None:
            cookies = self._extract_cookies(url)
        temp_path = f"{target_path}.tmp"
        etag = None
        last_modified = None

        # Long timeout for slow/paused streams (sock_read=120)
        timeout = aiohttp.ClientTimeout(total=None, sock_read=120, connect=30)



        while attempt < self.max_attempts:
            attempt += 1
            attempt_start_time = time.monotonic()
            bytes_in_this_attempt = 0

            # Determine if we can resume
            start_byte = 0
            if os.path.exists(temp_path):
                start_byte = os.path.getsize(temp_path)

            headers = self.headers.copy()
            # Merge extra headers provided by caller (e.g., User-Agent, Referer from Playwright)
            if extra_headers:
                headers.update(extra_headers)
            if start_byte > 0:
                headers["Range"] = f"bytes={start_byte}-"
                # If we previously received an ETag or Last-Modified, use If-Range to allow
                # the server to respond with partial content only if the resource is unchanged.
                if etag:
                    headers["If-Range"] = etag
                elif last_modified:
                    headers["If-Range"] = last_modified
                mode = "ab"
                logger.info(f"Download attempt {attempt}: Resuming from {start_byte} bytes")
            else:
                headers["Range"] = "bytes=0-"
                mode = "wb"
                logger.info(f"Download attempt {attempt}: Starting fresh")

            try:
                async with aiohttp.ClientSession(headers=headers, timeout=timeout, cookies=cookies) as session:
                    # Determine default mode: allow environment override so we can
                    # make ranged-chunk mode the default behavior. Set
                    # STT_RANGED_DEFAULT=0 to prefer normal streaming GET first.
                    use_ranged_chunks = os.getenv("STT_RANGED_DEFAULT", "true").lower() in ("1", "true", "yes")

                    # If default is not ranged-chunk, try a normal streaming GET first (server may stream fine)
                    if not use_ranged_chunks:
                        use_ranged_chunks = False
                    else:
                        # We will skip the initial long-lived streaming GET and go straight
                        # to ranged-chunk mode which is more resilient to throttling.
                        logger.debug("STT_RANGED_DEFAULT is true: using ranged-chunk as default")
                    try:
                        async with session.get(url, allow_redirects=True) as response:
                            # Validation: HTTP status
                            if response.status == 416:
                                logger.info("Server returned 416 (Range Not Satisfiable). Assuming download is complete.")
                                break

                            if response.status not in (200, 206):
                                text = await response.text()
                                raise DownloadError(f"HTTP {response.status}: {text[:200]}")

                            # Capture ETag/Last-Modified for potential resume
                            etag = response.headers.get("ETag") or etag
                            last_modified = response.headers.get("Last-Modified") or last_modified
                            accept_ranges = response.headers.get('Accept-Ranges', '').lower()
                            logger.debug(f"Response headers: ETag={etag} Last-Modified={last_modified} Accept-Ranges={accept_ranges}")

                            # If server advertises Accept-Ranges=bytes or responded with 206,
                            # prefer ranged chunked downloads which create short requests
                            # and avoid long-lived throttled connections.
                            if accept_ranges == 'bytes' or response.status == 206:
                                use_ranged_chunks = True

                            # If server didn't advertise ranges but the response appears
                            # to be chunked and stalls, we'll fall back to ranged chunks below.
                            content_type = response.headers.get("Content-Type", "").lower()
                            if "text/html" in content_type:
                                raise DownloadError(f"Expected audio, got {content_type}")

                            if not use_ranged_chunks:
                                # Write streaming response as before
                                with open(temp_path, mode) as f:
                                    async for chunk in response.content.iter_chunked(self.chunk_size):
                                        if chunk:
                                            if start_byte == 0 and bytes_in_this_attempt == 0:
                                                if chunk.startswith(b"<!DOCTYPE html>") or chunk.startswith(b"<html>"):
                                                    raise DownloadError("First chunk indicates HTML content")

                                            await asyncio.to_thread(f.write, chunk)
                                            bytes_in_this_attempt += len(chunk)

                    except (asyncio.TimeoutError, aiohttp.ClientPayloadError) as e:
                        # If the streaming GET timed out or payload error occurred, switch to ranged-chunk mode
                        logger.warning(f"Streaming GET failed, switching to ranged chunk mode: {e}")
                        use_ranged_chunks = True

                    if use_ranged_chunks:
                        # Perform repeated ranged requests of a modest size to avoid long throttled connections.
                        ranged_chunk = max(self.chunk_size, 64 * 1024)
                        # Recalculate start_byte in case data was written by earlier streaming attempt
                        start_byte = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0
                        logger.info(f"Using ranged-chunk download mode, starting at byte {start_byte}, chunk={ranged_chunk}")

                        # Allow chunk size and small read timeout to be tuned via env vars
                        ranged_chunk = int(os.getenv("STT_RANGED_CHUNK", str(max(self.chunk_size, 64 * 1024))))
                        small_read_timeout = int(os.getenv("STT_RANGED_READ_TIMEOUT", "30"))
                        ranged_max_attempts = int(os.getenv("STT_RANGED_MAX_ATTEMPTS", "10000"))

                        # Recalculate start_byte in case data was written by earlier streaming attempt
                        start_byte = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0
                        logger.info(f"Using ranged-chunk download mode, starting at byte {start_byte}, chunk={ranged_chunk}")

                        ranged_attempt = 0
                        total_expected_size = None
                        while True:
                            ranged_attempt += 1
                            range_end = start_byte + ranged_chunk - 1
                            headers["Range"] = f"bytes={start_byte}-{range_end}"
                            # Use a short read timeout for small ranged requests
                            small_timeout = aiohttp.ClientTimeout(total=None, sock_read=small_read_timeout, connect=15)
                            async with aiohttp.ClientSession(headers=headers, timeout=small_timeout, cookies=cookies) as small_sess:
                                async with small_sess.get(url, allow_redirects=True) as r:
                                    status = r.status
                                    if status == 416:
                                        logger.info("Server returned 416 during ranged request. Assuming complete.")
                                        break

                                    body_preview = None
                                    if status not in (200, 206):
                                        text = await r.text()
                                        raise DownloadError(f"HTTP {status}: {text[:200]}")

                                    # Extract total size from Content-Range if possible (e.g. bytes 0-1023/5000)
                                    content_range = r.headers.get("Content-Range")
                                    if content_range and "/" in content_range:
                                        try:
                                            total_expected_size = int(content_range.split("/")[-1])
                                        except (ValueError, IndexError):
                                            pass

                                    # Capture ETag/Last-Modified for subsequent If-Range headers
                                    etag = r.headers.get("ETag") or etag
                                    last_modified = r.headers.get("Last-Modified") or last_modified

                                    chunk_body = await r.content.read(ranged_chunk)
                                    # Keep a tiny preview for logging/debugging
                                    if chunk_body:
                                        body_preview = chunk_body[:64]

                                    if not chunk_body:
                                        # No more data
                                        logger.debug(f"Ranged request {ranged_attempt}: no data returned (status={status})")
                                        if total_expected_size and start_byte < total_expected_size:
                                            logger.warning(f"Ranged request returned no data but expected more: {start_byte} < {total_expected_size}")
                                            # We will let the outer attempt loop retry
                                            raise DownloadError(f"Premature end of stream at {start_byte}/{total_expected_size}")
                                        break

                                    # Detect HTML first chunk
                                    if start_byte == 0 and bytes_in_this_attempt == 0:
                                        if chunk_body.startswith(b"<!DOCTYPE html>") or chunk_body.startswith(b"<html>"):
                                            raise DownloadError("Downloaded HTML instead of audio")

                                    # Write chunk
                                    with open(temp_path, 'ab') as f:
                                        f.write(chunk_body)

                                    bytes_in_this_attempt += len(chunk_body)
                                    start_byte += len(chunk_body)

                                    logger.info(
                                        f"Ranged request {ranged_attempt}: status={status} bytes={len(chunk_body)} total={start_byte} expected={total_expected_size} preview={body_preview[:16] if body_preview else None}"
                                    )

                                    # If server returned 200 (whole file), we are done
                                    if status == 200:
                                        break

                                    # If we know the total size, check if we reached it
                                    if total_expected_size and start_byte >= total_expected_size:
                                        logger.info(f"Reached expected total size: {start_byte}")
                                        break

                                    # If we received less than requested but no Content-Range to tell us there is more,
                                    # we might be done or the server might be just sending small chunks.
                                    # For safety with Sipuni, we continue as long as we get data.
                                    # But if status was 206 and we got data, we should probably continue unless we are sure.

                                    # Safety: stop after ranged_max_attempts to avoid infinite loops
                                    if ranged_attempt >= ranged_max_attempts:
                                        logger.warning(f"Reached ranged_max_attempts={ranged_max_attempts}, stopping ranged loop")
                                        break

                attempt_duration = time.monotonic() - attempt_start_time
                logger.info(
                    f"Attempt {attempt} finished",
                    extra={
                        "attempt": attempt,
                        "duration": round(attempt_duration, 2),
                        "bytes_downloaded": bytes_in_this_attempt,
                        "total_bytes_so_far": os.path.getsize(temp_path)
                    }
                )

                # If we made it through the stream without exception, we're done
                break

            except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                attempt_duration = time.monotonic() - attempt_start_time
                logger.warning(
                    f"Attempt {attempt} failed",
                    extra={
                        "attempt": attempt,
                        "duration": round(attempt_duration, 2),
                        "bytes_downloaded": bytes_in_this_attempt,
                        "error": str(e)
                    }
                )

                if attempt >= self.max_attempts:
                    if os.path.exists(temp_path):
                        try: os.remove(temp_path)
                        except: pass
                    raise DownloadError(f"Download failed after {attempt} attempts: {str(e)}")

                # Exponential backoff
                delay = self.base_backoff * (2 ** (attempt - 1)) + random.uniform(0, 1)
                await asyncio.sleep(delay)

        # Post-download validations
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
