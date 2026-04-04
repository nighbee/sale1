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

    async def download(self, url: str, target_path: str):
        """Download a file using parallel ranged requests and reassemble it.

        Falls back to single-stream download if server doesn't support ranges or total size is unknown.
        """
        temp_path = f"{target_path}.tmp"
        parts_dir = f"{target_path}.parts"
        os.makedirs(parts_dir, exist_ok=True)
        meta_path = os.path.join(parts_dir, "meta.json")

        cookies = self._extract_cookies(url)

        session_timeout = aiohttp.ClientTimeout(total=None)
        session = aiohttp.ClientSession(headers=self.headers, timeout=session_timeout, cookies=cookies,
                                        connector=aiohttp.TCPConnector(ssl=self.verify_ssl))

        try:
            logger.info("Probing server for size and range support", extra={"url": url})
            total_size, accept_ranges = await self._probe_server(session, url)
            logger.info("Probe result", extra={"total_size": total_size, "accept_ranges": accept_ranges})

            if total_size is None or not accept_ranges:
                logger.info("Server does not support ranged downloads or size unknown, falling back to single-stream", extra={"url": url})
                await self._single_stream_download(session, url, temp_path)
                # validate and move
                self._validate(temp_path, None)
                os.replace(temp_path, target_path)
                logger.info("Download success (single-stream)", extra={"target": target_path})
                return

            # build chunk ranges
            chunks = []  # list of (start, end, idx)
            idx = 0
            for start in range(0, total_size, self.chunk_size):
                end = min(start + self.chunk_size - 1, total_size - 1)
                chunks.append((start, end, idx))
                idx += 1

            total_chunks = len(chunks)
            logger.info(f"Downloading {total_size} bytes in {total_chunks} chunks (chunk_size={self.chunk_size})", extra={"url": url})

            # load meta if exists
            completed = set()
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, 'r', encoding='utf-8') as mf:
                        meta = json.load(mf)
                        if meta.get('total_size') == total_size and meta.get('chunk_size') == self.chunk_size:
                            completed = set(meta.get('completed', []))
                except Exception:
                    logger.debug("Failed to load meta, starting fresh")

            semaphore = asyncio.Semaphore(self.max_concurrency)
            chunk_tasks = []

            async def schedule_chunk(start, end, idx):
                if idx in completed:
                    logger.debug(f"Skipping already completed chunk {idx}")
                    return True
                await semaphore.acquire()
                try:
                    ok = await self._download_chunk_with_retries(session, url, start, end, idx, parts_dir)
                    if ok:
                        completed.add(idx)
                        # update meta
                        try:
                            with open(meta_path, 'w', encoding='utf-8') as mf:
                                json.dump({
                                    'total_size': total_size,
                                    'chunk_size': self.chunk_size,
                                    'completed': sorted(list(completed))
                                }, mf)
                        except Exception:
                            logger.debug("Failed to write meta file")
                    return ok
                finally:
                    semaphore.release()

            for start, end, i in chunks:
                task = asyncio.create_task(schedule_chunk(start, end, i))
                chunk_tasks.append(task)

            # await all scheduled tasks and fail if any chunk failed
            results = await asyncio.gather(*chunk_tasks, return_exceptions=True)
            failed = [r for r in results if r is not True]
            if failed:
                raise DownloadError(f"Some chunks failed: {failed}")

            # reassemble
            logger.info("All chunks downloaded, reassembling file", extra={"target": target_path})
            await asyncio.to_thread(self._assemble_file, parts_dir, temp_path, total_chunks)

            # validate
            self._validate(temp_path, total_size)

            os.replace(temp_path, target_path)
            # cleanup
            try:
                for fn in os.listdir(parts_dir):
                    os.remove(os.path.join(parts_dir, fn))
                os.rmdir(parts_dir)
            except Exception:
                pass

            logger.info("Download success", extra={"target": target_path, "bytes": total_size})

        finally:
            await session.close()

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