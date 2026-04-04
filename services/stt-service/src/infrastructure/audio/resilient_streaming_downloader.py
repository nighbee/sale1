import os
import time
import asyncio
import logging
import aiohttp
import random
import json
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlparse, parse_qs
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Base class for download failures."""
    pass

class ResilientStreamingDownloader(AudioDownloader):
    """
    A production-grade robust streaming downloader using aiohttp.
    Specifically designed to handle unstable servers like Sipuni.
    """
    def __init__(
        self,
        chunk_size: int = 16384,  # 16KB
        min_file_size: int = 5120, # 5KB
        max_attempts_per_file: int = 50,
        base_backoff: float = 1.0,
        circuit_breaker_threshold: int = 3,
        verify_ssl: bool = True,
        **kwargs
    ):
        self.chunk_size = chunk_size
        self.min_file_size = min_file_size
        self.max_attempts_per_file = max_attempts_per_file
        self.base_backoff = base_backoff
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.verify_ssl = verify_ssl

        # Browser-like headers
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "audio/*, */*;q=0.8",
            "Accept-Encoding": "identity", # Disable compression (avoid gzip/br for audio)
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }

    def _extract_cookies(self, url: str) -> Dict[str, str]:
        """Extracts cookies from URL parameters for Sipuni authentication."""
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

    async def _create_session(self, cookies: Dict[str, str]) -> aiohttp.ClientSession:
        # Hard Timeouts: detects stalls earlier than before (60s instead of 300s)
        timeout = aiohttp.ClientTimeout(
            total=3600,     # Max 1 hour per request attempt
            connect=15,     # Connection timeout
            sock_read=60    # Socket read timeout (wait for data chunks)
        )
        logger.info("Creating new aiohttp session (circuit breaker or initial)")
        return aiohttp.ClientSession(
            headers=self.headers,
            timeout=timeout,
            cookies=cookies,
            connector=aiohttp.TCPConnector(ssl=self.verify_ssl)
        )

    async def download(self, url: str, target_path: str, cookies: Dict[str, str] = None, extra_headers: Dict[str, str] = None) -> None:
        start_total_time = time.monotonic()
        logger.info("Starting ResilientStreamingDownloader", extra={"url": url, "target": target_path})

        if cookies is None:
            cookies = self._extract_cookies(url)

        temp_path = f"{target_path}.tmp"
        metadata_path = f"{target_path}.meta"

        attempt = 0
        consecutive_failures = 0
        session = None

        # Safe Resume State
        expected_total_size = None
        use_range = True
        start_byte = 0

        try:
            while attempt < self.max_attempts_per_file:
                attempt += 1

                # Circuit Breaker: Recreate session after N consecutive failures
                if session is None or consecutive_failures >= self.circuit_breaker_threshold:
                    if session:
                        await session.close()
                    session = await self._create_session(cookies)
                    consecutive_failures = 0

                # Determine start byte and validate resume capability
                if use_range and os.path.exists(temp_path) and os.path.exists(metadata_path):
                    start_byte = os.path.getsize(temp_path)
                else:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                    start_byte = 0

                try:
                    result_byte, result_total, progress_made = await self._perform_attempt(
                        session, url, temp_path, metadata_path, start_byte,
                        expected_total_size, use_range, extra_headers
                    )

                    start_byte = result_byte
                    if result_total:
                        expected_total_size = result_total

                    if progress_made:
                        consecutive_failures = 0

                    # If we reached here, the attempt finished either successfully or by completing the stream
                    if expected_total_size and start_byte >= expected_total_size:
                        break

                    # If we finished the stream but don't know the size, we might be done
                    if not expected_total_size:
                        logger.warning("Stream finished but expected size is unknown. Assuming completion.")
                        break

                except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                    consecutive_failures += 1
                    duration = time.monotonic() - start_total_time
                    logger.warning(
                        f"Attempt {attempt} failed after {duration:.1f}s: {e}. "
                        f"Total bytes received: {start_byte}. Failures: {consecutive_failures}",
                        extra={"url": url}
                    )

                    if attempt >= self.max_attempts_per_file or "HTML" in str(e):
                        raise DownloadError(f"Download failed after {attempt} attempts: {e}")

                    # Handle resource changed or server size mismatch by disabling Range
                    if "Resource changed" in str(e) or "size inconsistency" in str(e) or "incorrect Range offset" in str(e):
                        use_range = False

                    # Exponential backoff with jitter
                    delay = self.base_backoff * (1.5 ** min(attempt, 6)) + random.uniform(0, 1)
                    await asyncio.sleep(delay)

            self._validate_final_file(temp_path, expected_total_size)

            # Atomic swap
            os.replace(temp_path, target_path)
            if os.path.exists(metadata_path):
                try: os.remove(metadata_path)
                except: pass

            logger.info(
                "Streaming download successful",
                extra={
                    "url": url,
                    "size": os.path.getsize(target_path),
                    "attempts": attempt,
                    "duration": round(time.monotonic() - start_total_time, 2)
                }
            )

        finally:
            if session:
                await session.close()
            # Clean up metadata if failed permanently
            if not os.path.exists(target_path) and os.path.exists(metadata_path):
                try: os.remove(metadata_path)
                except: pass

    async def _perform_attempt(
        self, session: aiohttp.ClientSession, url: str, temp_path: str, metadata_path: str,
        start_byte: int, expected_total_size: Optional[int], use_range: bool, extra_headers: Dict[str, str] = None
    ) -> Tuple[int, Optional[int], bool]:

        request_headers = self.headers.copy()
        if extra_headers:
            request_headers.update(extra_headers)
        request_headers["Referer"] = url

        if use_range and start_byte > 0:
            request_headers["Range"] = f"bytes={start_byte}-"
            logger.info(f"Resuming from byte {start_byte}", extra={"url": url})
        else:
            start_byte = 0
            logger.info("Starting fresh download", extra={"url": url})

        async with session.get(url, allow_redirects=True, headers=request_headers) as response:
            # Handle 416 (Requested Range Not Satisfiable)
            if response.status == 416:
                if expected_total_size and start_byte >= expected_total_size:
                    return start_byte, expected_total_size, False
                raise DownloadError("Server returned 416 but file is incomplete")

            if response.status not in (200, 206):
                text = await response.text()
                raise DownloadError(f"HTTP {response.status}: {text[:200]}")

            # Ensure we aren't downloading an HTML error page
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" in content_type:
                raise DownloadError(f"Expected audio, got {content_type}")

            # Handle metadata and Range support
            new_start_byte, server_total_size = await self._handle_response_metadata(
                response, temp_path, metadata_path, start_byte, expected_total_size
            )

            # Consume stream
            final_byte, progress_made = await self._consume_response(response, temp_path, new_start_byte, server_total_size)

            return final_byte, server_total_size, progress_made

    async def _handle_response_metadata(
        self, response: aiohttp.ClientResponse, temp_path: str, metadata_path: str,
        start_byte: int, expected_total_size: Optional[int]
    ) -> Tuple[int, Optional[int]]:

        current_etag = response.headers.get("ETag")
        current_modified = response.headers.get("Last-Modified")

        if start_byte > 0:
            if response.status == 200:
                logger.warning("Server ignored Range header, restarting from 0")
                start_byte = 0
                if os.path.exists(temp_path): os.remove(temp_path)
            else:
                meta = self._read_meta(metadata_path)
                if (meta.get("etag") and current_etag and meta["etag"] != current_etag) or \
                   (meta.get("last_modified") and current_modified and meta["last_modified"] != current_modified):
                    raise DownloadError("Resource changed (ETag/Last-Modified mismatch)")

        self._save_meta(metadata_path, {"etag": current_etag, "last_modified": current_modified})

        # Content-Range validation
        server_total_size = None
        content_range = response.headers.get("Content-Range")
        if content_range and "/" in content_range:
            try:
                server_total_size = int(content_range.split("/")[-1])
                if "bytes " in content_range:
                    range_part = content_range.split(" ")[1].split("/")[0]
                    actual_start = int(range_part.split("-")[0])
                    if actual_start != start_byte:
                        raise DownloadError(f"Range mismatch: Server started at {actual_start}, we expected {start_byte}")
            except (ValueError, IndexError):
                pass

        if server_total_size is None:
            cl = response.headers.get("Content-Length")
            if cl:
                server_total_size = int(cl) + (start_byte if response.status == 206 else 0)

        if server_total_size and expected_total_size and server_total_size != expected_total_size:
            raise DownloadError(f"Total size inconsistency: {server_total_size} vs {expected_total_size}")

        return start_byte, server_total_size

    async def _consume_response(self, response: aiohttp.ClientResponse, temp_path: str, start_byte: int, total_size: Optional[int]) -> Tuple[int, bool]:
        mode = "ab" if start_byte > 0 and response.status == 206 else "wb"
        current_byte = start_byte
        progress_made = False
        last_log_time = time.monotonic()

        with open(temp_path, mode) as f:
            async for chunk in response.content.iter_any():
                if chunk:
                    # Anti-HTML guard
                    if current_byte == 0 and chunk.strip().lower().startswith((b"<!doctype", b"<html")):
                        raise DownloadError("Detected HTML content instead of audio")

                    await asyncio.to_thread(f.write, chunk)
                    current_byte += len(chunk)
                    progress_made = True

                    # Periodic progress logging
                    if time.monotonic() - last_log_time > 10:
                        percent = f" ({100 * current_byte / total_size:.1f}%)" if total_size else ""
                        logger.info(f"Download progress: {current_byte} bytes{percent}")
                        last_log_time = time.monotonic()

        return current_byte, progress_made

    def _validate_final_file(self, path: str, expected_total_size: Optional[int]):
        if not os.path.exists(path):
            raise DownloadError("Download failed: Temporary file missing")

        final_size = os.path.getsize(path)
        if expected_total_size and final_size != expected_total_size:
            raise DownloadError(f"Final size mismatch: {final_size} != {expected_total_size}")

        if final_size < self.min_file_size:
            raise DownloadError(f"Downloaded file too small ({final_size} bytes)")

    def _save_meta(self, path: str, data: Dict[str, Any]):
        try:
            with open(path, "w") as f:
                json.dump(data, f)
        except Exception as e:
            logger.warning(f"Failed to save metadata: {e}")

    def _read_meta(self, path: str) -> Dict[str, Any]:
        if not os.path.exists(path): return {}
        try:
            with open(path, "r") as f:
                return json.load(f)
        except: return {}
