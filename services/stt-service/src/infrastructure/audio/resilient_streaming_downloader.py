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
        max_attempts_per_file: int = 20,
        max_attempts_per_chunk: int = 5,
        base_backoff: float = 1.0,
        circuit_breaker_threshold: int = 3,
        verify_ssl: bool = True,
    ):
        self.chunk_size = chunk_size
        self.min_file_size = min_file_size
        self.max_attempts_per_file = max_attempts_per_file
        self.max_attempts_per_chunk = max_attempts_per_chunk
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

        # Hard Timeouts
        # We use a total timeout per request but also sock_read to detect stalls
        timeout = aiohttp.ClientTimeout(
            total=3600,     # Max 1 hour per request attempt
            connect=20,     # Connection timeout
            sock_read=300    # Socket read timeout (wait for data chunks)
        )

        try:
            while attempt < self.max_attempts_per_file:
                attempt += 1

                # Circuit Breaker: Recreate session after N consecutive failures
                if session is None or consecutive_failures >= self.circuit_breaker_threshold:
                    if session:
                        await session.close()
                    logger.info("Creating new aiohttp session (circuit breaker or initial)")
                    session = aiohttp.ClientSession(
                        headers=self.headers,
                        timeout=timeout,
                        cookies=cookies,
                        connector=aiohttp.TCPConnector(ssl=self.verify_ssl)
                    )
                    consecutive_failures = 0

                # Determine start byte and validate resume capability
                start_byte = 0
                if use_range and os.path.exists(temp_path) and os.path.exists(metadata_path):
                    start_byte = os.path.getsize(temp_path)

                # Construct headers for this attempt
                request_headers = self.headers.copy()
                if extra_headers:
                    request_headers.update(extra_headers)
                request_headers["Referer"] = url

                if use_range and start_byte > 0:
                    request_headers["Range"] = f"bytes={start_byte}-"
                    logger.info(f"Attempt {attempt}: Resuming from byte {start_byte}", extra={"url": url})
                else:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                    start_byte = 0
                    logger.info(f"Attempt {attempt}: Starting fresh download", extra={"url": url})

                try:
                    # FIX: Pass request_headers to session.get
                    async with session.get(url, allow_redirects=True, headers=request_headers) as response:
                        # Handle 416 (Requested Range Not Satisfiable)
                        if response.status == 416:
                            logger.info("Server returned 416. Verifying if we already have the full file.")
                            if expected_total_size and start_byte >= expected_total_size:
                                break
                            # If we don't know the size, we can't be sure. Restart.
                            use_range = False
                            continue

                        if response.status not in (200, 206):
                            text = await response.text()
                            raise DownloadError(f"HTTP {response.status}: {text[:200]}")

                        # Validate Metadata (ETag / Last-Modified)
                        current_etag = response.headers.get("ETag")
                        current_modified = response.headers.get("Last-Modified")

                        if start_byte > 0:
                            # 1. If we asked for Range but got 200 OK, server doesn't support/ignored Range
                            if response.status == 200:
                                logger.warning("Server ignored Range header, restarting from 0")
                                start_byte = 0
                                if os.path.exists(temp_path): os.remove(temp_path)
                            else:
                                # 2. Validate ETag/Last-Modified consistency
                                meta = self._read_meta(metadata_path)
                                etag_mismatch = meta.get("etag") and current_etag and meta["etag"] != current_etag
                                mod_mismatch = meta.get("last_modified") and current_modified and meta["last_modified"] != current_modified

                                if etag_mismatch or mod_mismatch:
                                    logger.warning(f"Resource changed (ETag: {etag_mismatch}, Mod: {mod_mismatch}), restarting.")
                                    start_byte = 0
                                    if os.path.exists(temp_path): os.remove(temp_path)

                        # Save metadata for next time
                        self._save_meta(metadata_path, {"etag": current_etag, "last_modified": current_modified})

                        # Content-Range & Total Size Consistency Check
                        content_range = response.headers.get("Content-Range")
                        server_total_size = None
                        if content_range and "/" in content_range:
                            try:
                                server_total_size = int(content_range.split("/")[-1])
                                # Validation: Range start must match our start_byte
                                if "bytes " in content_range:
                                    range_part = content_range.split(" ")[1].split("/")[0]
                                    actual_start = int(range_part.split("-")[0])
                                    if actual_start != start_byte:
                                        logger.error(f"Range mismatch: Server started at {actual_start}, we expected {start_byte}")
                                        use_range = False # Switch to full download
                                        raise DownloadError("Server returned incorrect Range offset")
                            except Exception as e:
                                if not isinstance(e, DownloadError):
                                    logger.warning(f"Failed to parse Content-Range: {e}")

                        if server_total_size is None:
                            content_length = response.headers.get("Content-Length")
                            if content_length:
                                cl = int(content_length)
                                server_total_size = cl + start_byte if response.status == 206 else cl

                        # Detect server instability (size changes)
                        if server_total_size and expected_total_size and server_total_size != expected_total_size:
                            logger.warning(f"Server reported different size: {server_total_size} vs {expected_total_size}. Switching to full download.")
                            use_range = False
                            expected_total_size = server_total_size
                            raise DownloadError("Total size inconsistency detected")

                        if server_total_size:
                            expected_total_size = server_total_size

                        # Write Mode
                        mode = "ab" if start_byte > 0 and response.status == 206 else "wb"

                        # TRUE Streaming Consumption
                        with open(temp_path, mode) as f:
                            # Inner chunk loop with its own retry logic
                            chunk_attempt = 0
                            while chunk_attempt < self.max_attempts_per_chunk:
                                try:
                                    async for chunk in response.content.iter_chunked(self.chunk_size):
                                        if chunk:
                                            # Anti-HTML guard (especially for Sipuni redirects/errors)
                                            if start_byte == 0 and chunk.strip().lower().startswith((b"<!doctype", b"<html")):
                                                raise DownloadError("Detected HTML content instead of audio")

                                            await asyncio.to_thread(f.write, chunk)
                                            start_byte += len(chunk)
                                            consecutive_failures = 0 # Reset on successful chunk
                                            chunk_attempt = 0 # Reset on successful chunk
                                    break # Stream finished successfully
                                except (aiohttp.ClientError, asyncio.TimeoutError, IOError) as e:
                                    chunk_attempt += 1
                                    logger.warning(f"Chunk read failed ({chunk_attempt}/{self.max_attempts_per_chunk}): {e}")
                                    if chunk_attempt >= self.max_attempts_per_chunk:
                                        raise DownloadError(f"Chunk read failed after {chunk_attempt} attempts: {e}")
                                    # We need to resume the entire request because response.content is exhausted/broken
                                    raise # Re-throw to the outer loop to perform a Range request resume

                        # Verify if we received everything expected
                        if expected_total_size and start_byte < expected_total_size:
                            raise DownloadError(f"Stream interrupted: {start_byte}/{expected_total_size} bytes received")

                        # If we reached here, the loop finished successfully
                        break

                except (aiohttp.ClientError, asyncio.TimeoutError, DownloadError, IOError) as e:
                    consecutive_failures += 1
                    duration = time.monotonic() - start_total_time
                    logger.warning(f"Attempt {attempt} failed after {duration:.1f}s: {e}. Failures: {consecutive_failures}", extra={"url": url})

                    if attempt >= self.max_attempts_per_file:
                        raise DownloadError(f"Download failed after {attempt} attempts: {e}")

                    # Exponential backoff with jitter
                    delay = self.base_backoff * (1.5 ** min(attempt, 6)) + random.uniform(0, 1)
                    await asyncio.sleep(delay)

            # Final Validation
            if not os.path.exists(temp_path):
                raise DownloadError("Download failed: Temporary file missing")

            final_size = os.path.getsize(temp_path)
            if expected_total_size and final_size != expected_total_size:
                logger.error(f"Size mismatch: {final_size} != {expected_total_size}")
                raise DownloadError(f"Final size mismatch: {final_size} != {expected_total_size}")

            if final_size < self.min_file_size:
                raise DownloadError(f"Downloaded file too small ({final_size} bytes)")

            # Atomic swap
            os.replace(temp_path, target_path)
            if os.path.exists(metadata_path):
                try: os.remove(metadata_path)
                except: pass

            logger.info(
                "Streaming download successful",
                extra={
                    "url": url,
                    "size": final_size,
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
