import os
import time
import asyncio
import logging
import aiohttp
import random
import json
from typing import Optional, Dict, Any
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)


class DownloadError(Exception):
    pass


class ResilientStreamingDownloader:
    def __init__(
        self,
        chunk_size: int = 16384,
        min_file_size: int = 5120,
        max_attempts_per_file: int = 50,
        base_backoff: float = 1.0,
        circuit_breaker_threshold: int = 3,
        verify_ssl: bool = True,
    ):
        self.chunk_size = chunk_size
        self.min_file_size = min_file_size
        self.max_attempts_per_file = max_attempts_per_file
        self.base_backoff = base_backoff
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.verify_ssl = verify_ssl

        self.headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "audio/*, */*;q=0.8",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
        }

    def _extract_cookies(self, url: str) -> Dict[str, str]:
        cookies = {}
        parsed = urlparse(url)
        params = parse_qs(parsed.query)

        if "sipuni.com" in parsed.netloc:
            if "hash" in params:
                cookies["hcode"] = params["hash"][0]
            if "user" in params:
                cookies["user"] = params["user"][0]

        return cookies

    async def _create_session(self, cookies):
        timeout = aiohttp.ClientTimeout(
            total=3600,
            connect=15,
            sock_read=60
        )

        return aiohttp.ClientSession(
            headers=self.headers,
            timeout=timeout,
            cookies=cookies,
            connector=aiohttp.TCPConnector(ssl=self.verify_ssl)
        )

    async def download(self, url: str, target_path: str):
        temp_path = f"{target_path}.tmp"
        meta_path = f"{target_path}.meta"

        cookies = self._extract_cookies(url)

        attempt = 0
        failures = 0
        session = None
        expected_size = None
        use_range = True

        try:
            while attempt < self.max_attempts_per_file:
                attempt += 1

                # circuit breaker
                if session is None or failures >= self.circuit_breaker_threshold:
                    if session:
                        await session.close()
                    session = await self._create_session(cookies)
                    failures = 0

                # ✅ SINGLE SOURCE OF TRUTH
                start_byte = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0

                logger.info(f"Download attempt {attempt}, resume from {start_byte}")

                try:
                    expected_size = await self._attempt(
                        session,
                        url,
                        temp_path,
                        meta_path,
                        start_byte,
                        expected_size,
                        use_range
                    )

                    # ✅ recompute AFTER attempt
                    current_size = os.path.getsize(temp_path)

                    if expected_size and current_size >= expected_size:
                        break

                except Exception as e:
                    failures += 1

                    current_size = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0

                    logger.warning(
                        f"Attempt {attempt} failed: {e} | bytes={current_size}"
                    )

                    if attempt >= self.max_attempts_per_file:
                        raise DownloadError(str(e))

                    # fallback: disable range if weird server behavior
                    if "Range" in str(e) or "mismatch" in str(e):
                        use_range = False

                    delay = self.base_backoff * (1.5 ** min(attempt, 6)) + random.uniform(0, 1)
                    await asyncio.sleep(delay)

            self._validate(temp_path, expected_size)

            os.replace(temp_path, target_path)
            if os.path.exists(meta_path):
                os.remove(meta_path)

            logger.info("Download success")

        finally:
            if session:
                await session.close()

    async def _attempt(
        self,
        session,
        url,
        temp_path,
        meta_path,
        start_byte,
        expected_size,
        use_range
    ):

        headers = self.headers.copy()
        headers["Referer"] = url

        if use_range and start_byte > 0:
            headers["Range"] = f"bytes={start_byte}-"
        else:
            start_byte = 0

        async with session.get(url, headers=headers) as resp:
            if resp.status not in (200, 206):
                raise DownloadError(f"HTTP {resp.status}")

            if "text/html" in resp.headers.get("Content-Type", ""):
                raise DownloadError("Got HTML instead of audio")

            total_size = self._get_total_size(resp, start_byte, expected_size)

            await self._stream(resp, temp_path, start_byte)

            return total_size

    def _get_total_size(self, resp, start_byte, expected_size):
        cr = resp.headers.get("Content-Range")

        if cr and "/" in cr:
            total = int(cr.split("/")[-1])
        else:
            cl = resp.headers.get("Content-Length")
            total = int(cl) + start_byte if cl else None

        if expected_size and total and expected_size != total:
            raise DownloadError("Size mismatch")

        return total

    async def _stream(self, resp, path, start_byte):
        mode = "ab" if start_byte > 0 and resp.status == 206 else "wb"

        with open(path, mode) as f:
            last_data_time = time.monotonic()

            async for chunk in resp.content.iter_chunked(self.chunk_size):
                if not chunk:
                    continue

                await asyncio.to_thread(f.write, chunk)

                last_data_time = time.monotonic()

                # 🔥 stall detection
                if time.monotonic() - last_data_time > 30:
                    raise DownloadError("Stream stalled")

    def _validate(self, path, expected):
        if not os.path.exists(path):
            raise DownloadError("Missing file")

        size = os.path.getsize(path)

        if expected and size != expected:
            raise DownloadError(f"Size mismatch {size} != {expected}")

        if size < self.min_file_size:
            raise DownloadError("File too small")