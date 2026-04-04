import os
import time
import asyncio
import logging
import aiohttp
from pathlib import Path
import httpx
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
        chunk_size: int = 64 * 1024,
        max_concurrency: int = 4,
        max_retries_per_chunk: int = 3,
        per_request_timeout: int = 30,
        session_connect_timeout: int = 15,
        min_file_size: int = 5 * 1024,
        verify_ssl: bool = True,
        base_backoff: float = 0.5,
    ):
        """Resilient downloader that downloads file ranges in parallel and reassembles them.

        Args:
            chunk_size: size of each ranged chunk in bytes (default 64KB)
            max_concurrency: how many chunk downloads to run in parallel
            max_retries_per_chunk: retries per chunk on failure
            per_request_timeout: sock_read timeout in seconds for each ranged request
            session_connect_timeout: connect timeout for aiohttp session
            min_file_size: minimal acceptable file size (sanity)
            verify_ssl: whether to verify SSL certs
            base_backoff: backoff factor between retries
        """
        self.chunk_size = int(chunk_size)
        self.max_concurrency = int(max_concurrency)
        self.max_retries_per_chunk = int(max_retries_per_chunk)
        self.per_request_timeout = int(per_request_timeout)
        self.session_connect_timeout = int(session_connect_timeout)
        self.min_file_size = int(min_file_size)
        self.verify_ssl = verify_ssl
        self.base_backoff = float(base_backoff)

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

    async def download(self, url: str, path: Path):
        """Download `url` to `path` using ranged chunk downloads with per-chunk retries,
        exponential backoff + jitter, smaller chunk sizes (16-32KB), optional prewarm,
        and per-request timeouts. Raises DownloadError on terminal failure.
        """
        # accept str or Path
        path = Path(path)
        temp_path = path.with_suffix(path.suffix + ".tmp")

        # clamp chunk size between 16KB and 32KB to avoid throttling
        chunk_size = max(16 * 1024, min(self.chunk_size, 32 * 1024))

        max_retries = max(1, getattr(self, "max_retries_per_chunk", 3))
        per_request_timeout = getattr(self, "per_request_timeout", 30)
        connect_timeout = getattr(self, "session_connect_timeout", 15)
        base_backoff = float(getattr(self, "base_backoff", 0.5))

        headers_base = dict(self.headers) if getattr(self, "headers", None) else {}
        cookies = self._extract_cookies(url) if hasattr(self, "_extract_cookies") else None

        logger.info("Starting download", extra={"url": url, "target": str(path), "chunk_size": chunk_size})

        timeout = httpx.Timeout(None, connect=connect_timeout, read=per_request_timeout)

        async with httpx.AsyncClient(headers=headers_base, timeout=timeout, verify=self.verify_ssl, follow_redirects=True, cookies=cookies) as client:
            # Probe server for accept-ranges and total size
            total_size = None
            accept_ranges = False

            try:
                resp = await client.head(url, follow_redirects=True)
                if resp.status_code in (200, 206):
                    cl = resp.headers.get("Content-Length")
                    if cl and cl.isdigit():
                        total_size = int(cl)
                    accept_ranges = resp.headers.get("Accept-Ranges", "").lower() == "bytes"
                    logger.debug("HEAD probe", extra={"status": resp.status_code, "content-length": cl, "accept_ranges": accept_ranges})
            except Exception as e:
                logger.debug("HEAD probe failed", extra={"error": str(e)})

            # If HEAD didn't give size, try a ranged GET (0-0)
            if total_size is None:
                try:
                    probe_headers = dict(headers_base)
                    probe_headers["Range"] = "bytes=0-0"
                    probe = await client.get(url, headers=probe_headers, follow_redirects=True)
                    if probe.status_code in (200, 206):
                        cr = probe.headers.get("Content-Range")
                        if cr and "/" in cr:
                            try:
                                total_size = int(cr.split("/")[-1])
                            except Exception:
                                total_size = None
                        else:
                            cl = probe.headers.get("Content-Length")
                            if cl and cl.isdigit():
                                total_size = int(cl)
                        accept_ranges = probe.headers.get("Accept-Ranges", "").lower() == "bytes" or probe.status_code == 206
                        logger.debug("Ranged probe", extra={"status": probe.status_code, "content-range": cr, "total": total_size, "accept_ranges": accept_ranges})
                except Exception as e:
                    logger.debug("Ranged probe failed", extra={"error": str(e)})

            # If no total_size or ranges not supported => fallback to single-stream with retry logic
            if not accept_ranges or total_size is None:
                logger.info("Server does not support ranges or size unknown - falling back to single-stream", extra={"url": url})
                # Implement retry loop for single-stream as well
                single_retries = 0
                while single_retries <= max_retries:
                    try:
                        headers = dict(headers_base)
                        headers["Referer"] = url
                        logger.info("Single-stream attempt", extra={"attempt": single_retries + 1})
                        downloaded = 0
                        async with client.stream("GET", url, headers=headers) as resp:
                            if resp.status_code != 200:
                                if resp.status_code == 429 and single_retries < max_retries:
                                    raise httpx.HTTPStatusError("429 Too Many Requests", request=resp.request, response=resp)
                                raise DownloadError(f"Single-stream HTTP {resp.status_code}")
                            if "text/html" in (resp.headers.get("Content-Type") or "").lower():
                                raise DownloadError("Single-stream returned HTML")
                            # write to temp
                            temp_path.parent.mkdir(parents=True, exist_ok=True)
                            with open(temp_path, "wb") as f:
                                async for chunk in resp.aiter_bytes(chunk_size):
                                    if not chunk:
                                        continue
                                    await asyncio.to_thread(f.write, chunk)
                                    downloaded += len(chunk)
                        logger.info("Single-stream download completed", extra={"bytes": downloaded})
                        # validate
                        if downloaded < getattr(self, "min_file_size", 1):
                            raise DownloadError(f"Downloaded too small: {downloaded}")
                        temp_path.replace(path)
                        return
                    except (httpx.ReadTimeout, httpx.ConnectError, httpx.HTTPStatusError, DownloadError) as e:
                        single_retries += 1
                        if single_retries > max_retries:
                            logger.error("Single-stream download failed after retries", extra={"error": str(e)})
                            raise DownloadError(f"Single-stream failed: {e}") from e
                        # backoff with jitter
                        backoff = base_backoff * (2 ** (single_retries - 1))
                        jitter = random.uniform(0, backoff)
                        delay = backoff + jitter
                        logger.warning("Single-stream retry", extra={"attempt": single_retries + 1, "delay": delay, "error": str(e)})
                        await asyncio.sleep(delay)

            # At this point we have total_size and accept_ranges True
            logger.info("Proceeding with ranged download", extra={"total_size": total_size, "chunk_size": chunk_size})

            # Optional prewarm: fetch a small first-range to warm connection (helps some throttlers)
            prewarm_bytes = min(4096, chunk_size)
            try_prewarms = 0
            prewarm_done = False
            if prewarm_bytes > 0:
                while try_prewarms < 1 and not prewarm_done:
                    try:
                        ph = dict(headers_base)
                        ph["Range"] = f"bytes=0-{prewarm_bytes - 1}"
                        logger.debug("Prewarm request", extra={"range": ph["Range"]})
                        pre = await client.get(url, headers=ph)
                        if pre.status_code in (200, 206):
                            data = pre.content  # small, safe to access .content
                            temp_path.parent.mkdir(parents=True, exist_ok=True)
                            mode = "r+b" if temp_path.exists() else "wb"
                            if mode == "r+b":
                                f = open(temp_path, "r+b")
                            else:
                                f = open(temp_path, "wb")
                            try:
                                await asyncio.to_thread(f.seek, 0)
                                await asyncio.to_thread(f.write, data)
                                prewarm_done = True
                                logger.debug("Prewarm successful", extra={"bytes": len(data)})
                            finally:
                                await asyncio.to_thread(f.close)
                        else:
                            logger.debug("Prewarm returned non-2xx", extra={"status": pre.status_code})
                    except Exception as e:
                        logger.debug("Prewarm failed", extra={"error": str(e)})
                    finally:
                        try_prewarms += 1

            # Ensure temp file exists and is the right size (we will write at offsets)
            if not temp_path.exists():
                temp_path.parent.mkdir(parents=True, exist_ok=True)
                temp_path.write_bytes(b"")

            # Download chunks sequentially (per-chunk retries with exponential backoff + jitter)
            offset = 0
            while offset < total_size:
                start = offset
                end = min(offset + chunk_size - 1, total_size - 1)
                chunk_idx = start // chunk_size

                attempt = 0
                success = False
                last_exception = None

                while attempt <= max_retries and not success:
                    attempt += 1
                    try:
                        ch_headers = dict(headers_base)
                        ch_headers["Range"] = f"bytes={start}-{end}"
                        ch_headers["Referer"] = url
                        logger.info("Chunk attempt", extra={"chunk_idx": chunk_idx, "range": f"{start}-{end}", "attempt": attempt})

                        # use a fresh small timeout for this chunk
                        chunk_timeout = httpx.Timeout(None, connect=connect_timeout, read=per_request_timeout)
                        async with httpx.AsyncClient(headers=ch_headers, timeout=chunk_timeout, verify=self.verify_ssl, follow_redirects=True, cookies=cookies) as chunk_client:
                            resp = await chunk_client.get(url)
                            if resp.status_code == 429:
                                # throttle - treat as retryable
                                raise httpx.HTTPStatusError("429 Too Many Requests", request=resp.request, response=resp)
                            if resp.status_code not in (200, 206):
                                raise DownloadError(f"Chunk {chunk_idx} HTTP {resp.status_code}")

                            # read chunk body
                            body = await resp.aread()
                            if not body:
                                raise DownloadError(f"Chunk {chunk_idx} returned empty body")

                            # write body at correct offset
                            def write_at(path_obj: Path, pos: int, data: bytes):
                                with open(path_obj, "r+b") as fh:
                                    fh.seek(pos)
                                    fh.write(data)

                            # create file if missing
                            if not temp_path.exists():
                                temp_path.write_bytes(b"")

                            # ensure file large enough to seek and write
                            await asyncio.to_thread(write_at, temp_path, start, body)

                            logger.info("Chunk downloaded", extra={"chunk_idx": chunk_idx, "bytes": len(body)})
                            success = True
                            break

                    except (httpx.ReadTimeout, httpx.ConnectError, httpx.RemoteProtocolError, httpx.ProtocolError, httpx.HTTPStatusError, DownloadError) as exc:
                        last_exception = exc
                        # if exhausted
                        if attempt > max_retries:
                            logger.error("Chunk failed after retries", extra={"chunk_idx": chunk_idx, "error": str(exc)})
                            break
                        # compute backoff + jitter
                        backoff = base_backoff * (2 ** (attempt - 1))
                        jitter = random.uniform(0, backoff)
                        delay = backoff + jitter
                        logger.warning("Chunk retry scheduled", extra={"chunk_idx": chunk_idx, "attempt": attempt, "delay": delay, "error": str(exc)})
                        await asyncio.sleep(delay)
                    except Exception as exc:
                        last_exception = exc
                        logger.exception("Unexpected chunk error", extra={"chunk_idx": chunk_idx})
                        # break out to fail
                        break

                if not success:
                    raise DownloadError(f"Chunk {chunk_idx} failed after {max_retries} retries: {last_exception}")

                # advance offset
                offset = end + 1

            # finished all chunks; final validation
            final_size = temp_path.stat().st_size
            if final_size != total_size:
                raise DownloadError(f"Final size mismatch {final_size} != {total_size}")

            # move temp to final path atomically
            temp_path.replace(path)
            logger.info("Download complete", extra={"target": str(path), "bytes": final_size})

    async def _probe_server(self, session: aiohttp.ClientSession, url: str):
        """Try to determine total size and whether server accepts Range requests."""
        # Try HEAD first
        try:
            async with session.head(url, allow_redirects=True) as resp:
                if resp.status in (200, 206):
                    content_length = resp.headers.get('Content-Length')
                    accept_ranges = resp.headers.get('Accept-Ranges', '').lower() == 'bytes'
                    total = int(content_length) if content_length and content_length.isdigit() else None
                    return total, accept_ranges
        except Exception:
            logger.debug("HEAD probe failed, will try ranged GET")

        # Try ranged GET for first byte
        try:
            headers = self.headers.copy()
            headers['Range'] = 'bytes=0-0'
            async with session.get(url, headers=headers) as resp:
                if resp.status in (200, 206):
                    cr = resp.headers.get('Content-Range')
                    if cr and '/' in cr:
                        total = int(cr.split('/')[-1])
                    else:
                        cl = resp.headers.get('Content-Length')
                        total = int(cl) if cl and cl.isdigit() else None
                    accept_ranges = resp.headers.get('Accept-Ranges', '').lower() == 'bytes' or resp.status == 206
                    return total, accept_ranges
        except Exception as e:
            logger.debug(f"Ranged probe failed: {e}")

        return None, False

    async def _download_chunk_with_retries(self, session: aiohttp.ClientSession, url: str, start: int, end: int, idx: int, parts_dir: str) -> bool:
        retries = 0
        chunk_path = os.path.join(parts_dir, f"chunk_{idx}.part")
        expected_len = end - start + 1

        while retries <= self.max_retries_per_chunk:
            try:
                timeout = aiohttp.ClientTimeout(total=None, sock_read=self.per_request_timeout, connect=self.session_connect_timeout)
                headers = self.headers.copy()
                headers['Range'] = f'bytes={start}-{end}'
                headers['Referer'] = url

                logger.debug(f"Downloading chunk {idx} range={start}-{end} attempt={retries+1}")

                async with session.get(url, headers=headers, timeout=timeout) as resp:
                    if resp.status not in (200, 206):
                        raise DownloadError(f"Chunk {idx} HTTP {resp.status}")

                    # stream to file
                    with open(chunk_path, 'wb') as cf:
                        downloaded = 0
                        async for part in resp.content.iter_chunked(16 * 1024):
                            if part:
                                cf.write(part)
                                downloaded += len(part)

                if downloaded != expected_len and resp.status == 206:
                    # partial read
                    logger.warning(f"Chunk {idx} downloaded size mismatch {downloaded}!={expected_len}")
                logger.info(f"Chunk {idx} downloaded", extra={"idx": idx, "bytes": downloaded})
                return True

            except Exception as e:
                retries += 1
                logger.warning(f"Chunk {idx} attempt {retries} failed: {e}")
                if retries > self.max_retries_per_chunk:
                    logger.error(f"Chunk {idx} failed after {self.max_retries_per_chunk} retries")
                    return False
                backoff = self.base_backoff * (2 ** (retries - 1)) + random.uniform(0, 0.5)
                await asyncio.sleep(backoff)

        return False

    async def _single_stream_download(self, session: aiohttp.ClientSession, url: str, temp_path: str):
        timeout = aiohttp.ClientTimeout(total=None, sock_read=self.per_request_timeout, connect=self.session_connect_timeout)
        headers = self.headers.copy()
        headers['Referer'] = url
        logger.info("Starting single-stream download", extra={"url": url})
        async with session.get(url, headers=headers, timeout=timeout) as resp:
            if resp.status != 200:
                raise DownloadError(f"Single-stream HTTP {resp.status}")
            if 'text/html' in resp.headers.get('Content-Type', '').lower():
                raise DownloadError('Downloaded HTML instead of audio')
            with open(temp_path, 'wb') as f:
                downloaded = 0
                last_time = time.monotonic()
                async for chunk in resp.content.iter_chunked(16 * 1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        last_time = time.monotonic()
                    else:
                        # check for stall
                        if time.monotonic() - last_time > self.per_request_timeout:
                            raise DownloadError('Single-stream stalled')
        logger.info("Single-stream finished", extra={"bytes": downloaded})

    def _assemble_file(self, parts_dir: str, temp_path: str, total_chunks: int):
        """Write chunk files in order to temp_path."""
        with open(temp_path, 'wb') as out:
            total_written = 0
            for idx in range(total_chunks):
                chunk_path = os.path.join(parts_dir, f"chunk_{idx}.part")
                if not os.path.exists(chunk_path):
                    raise DownloadError(f"Missing chunk file {chunk_path}")
                with open(chunk_path, 'rb') as cf:
                    while True:
                        data = cf.read(64 * 1024)
                        if not data:
                            break
                        out.write(data)
                        total_written += len(data)
        logger.info("Assembled file", extra={"bytes": total_written})

    def _validate(self, path, expected):
        if not os.path.exists(path):
            raise DownloadError("Missing file")

        size = os.path.getsize(path)

        if expected and size != expected:
            raise DownloadError(f"Size mismatch {size} != {expected}")

        if size < self.min_file_size:
            raise DownloadError("File too small")