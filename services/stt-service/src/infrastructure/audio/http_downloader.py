import os
import asyncio
import logging
import time
from urllib.parse import urlparse
import httpx
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class HTTPDownloader(AudioDownloader):
    def __init__(
        self,
        max_attempts: int = 3,
        base_backoff: float = 2.0,
        streaming_chunk_size: int = 15 * 1024, # For chunked fallback
    ):
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff
        self.streaming_chunk_size = streaming_chunk_size

    async def download(self, url: str, target_path: str) -> None:
        await self._download_with_resume(url, target_path)

    async def _download_stream(self, url: str, target_path: str) -> None:
        start_time = time.monotonic()
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            follow_redirects=True,
            http2=False,
        ) as client:
            async with client.stream("GET", url) as response:
                logger.info(
                    "Streaming download response received",
                    extra={
                        "url": url,
                        "status": response.status_code,
                        "headers": dict(response.headers),
                    }
                )
                response.raise_for_status()
                bytes_downloaded = 0
                content_length = response.headers.get("content-length")
                total_kb = round(int(content_length) / 1024, 1) if content_length else "unknown"

                with open(target_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)
                        bytes_downloaded += len(chunk)
                        if bytes_downloaded % (100 * 1024) < len(chunk):
                            logger.info(
                                "Streaming download progress",
                                extra={
                                    "url": url,
                                    "downloaded_kb": round(bytes_downloaded / 1024, 1),
                                    "total_kb": total_kb,
                                },
                            )

        duration = round(time.monotonic() - start_time, 2)
        logger.info(
            "Streaming download completed",
            extra={
                "url": url,
                "total_kb": round(bytes_downloaded / 1024, 1),
                "duration_s": duration,
            },
        )

    async def _download_with_resume(self, url: str, target_path: str) -> None:
        async with httpx.AsyncClient(
            http2=False,
            timeout=httpx.Timeout(60.0, connect=10.0),
            follow_redirects=True,
        ) as client:
            last_size = -1
            etag = None
            for attempt in range(1, self.max_attempts + 1):
                try:
                    start_byte = 0
                    if os.path.exists(target_path):
                        start_byte = os.path.getsize(target_path)

                    if attempt > 1 and start_byte == last_size:
                         logger.warning(
                             "No progress made in previous attempt",
                             extra={"url": url, "start_byte": start_byte, "attempt": attempt}
                         )

                    last_size = start_byte
                    headers = {}
                    if start_byte > 0:
                        headers["Range"] = f"bytes={start_byte}-"
                        if etag:
                            headers["If-Range"] = etag

                    logger.info(
                        f"Download attempt {attempt}/{self.max_attempts}",
                        extra={"url": url, "start_byte": start_byte, "headers": headers}
                    )

                    async with client.stream("GET", url, headers=headers) as response:
                        # Log response headers for debugging
                        logger.info(
                            "Download response received",
                            extra={
                                "url": url,
                                "status": response.status_code,
                                "headers": dict(response.headers),
                                "attempt": attempt,
                            }
                        )

                        response.raise_for_status()
                        status = response.status_code
                        content_range = response.headers.get("content-range")
                        content_length = response.headers.get("content-length")
                        new_etag = response.headers.get("etag")
                        if new_etag: etag = new_etag

                        total_size = None
                        if status == 206 and content_range:
                            try:
                                total_size = int(content_range.split("/")[-1])
                            except Exception: pass
                        elif status == 200 and content_length:
                            try:
                                total_size = int(content_length)
                            except Exception: pass

                        mode = "ab" if (status == 206 and start_byte > 0) else "wb"
                        if status == 200 and start_byte > 0:
                            logger.warning("Server returned 200 instead of 206 for Range request. Overwriting file.")

                        bytes_received_this_attempt = 0
                        with open(target_path, mode) as f:
                            async for chunk in response.aiter_bytes():
                                f.write(chunk)
                                bytes_received_this_attempt += len(chunk)
                                if bytes_received_this_attempt % (100 * 1024) < len(chunk):
                                    logger.info(
                                        "Resume download progress",
                                        extra={
                                            "url": url,
                                            "attempt": attempt,
                                            "received_kb": round(bytes_received_this_attempt / 1024, 1),
                                            "current_total_kb": round(os.path.getsize(target_path) / 1024, 1),
                                        }
                                    )

                        current_size = os.path.getsize(target_path)
                        if total_size is not None and current_size >= total_size:
                            logger.info(
                                "Download completed successfully",
                                extra={"url": url, "total_bytes": current_size}
                            )
                            return

                        if total_size is None and bytes_received_this_attempt > 0:
                            # If we don't know the total size, but we finished the stream,
                            # we assume it might be done if it's not a Range request or if it is.
                            logger.info("Stream ended, unknown total size. Assuming complete.")
                            return

                        logger.warning(
                            "Partial transfer or stream interrupted",
                            extra={
                                "current_size": current_size,
                                "expected": total_size,
                                "attempt": attempt,
                            }
                        )

                except Exception as exc:
                    logger.warning(
                        f"Download attempt {attempt} failed: {str(exc)}",
                        extra={"url": url, "attempt": attempt}
                    )
                    if attempt == self.max_attempts:
                        logger.warning("All resume attempts failed, falling back to chunked download")
                        await self._download_in_chunks(url, target_path, client)
                        return

                backoff = self.base_backoff * (2 ** (attempt - 1))
                logger.info(f"Retrying in {backoff}s", extra={"attempt": attempt, "backoff": backoff})
                await asyncio.sleep(backoff)

    async def _download_in_chunks(
        self,
        url: str,
        target_path: str,
        client: httpx.AsyncClient,
    ) -> None:
        logger.info("Starting chunked download fallback", extra={"url": url})

        # Try to get total size first
        total_size = None
        etag = None
        try:
            head = await client.head(url)
            if head.status_code == 200:
                total_size = int(head.headers.get("content-length", 0))
                etag = head.headers.get("etag")
        except Exception: pass

        if not total_size:
            try:
                # Try getting just the first byte to see content-range
                resp = await client.get(url, headers={"Range": "bytes=0-0"})
                if resp.status_code == 206:
                    content_range = resp.headers.get("content-range", "")
                    if "/" in content_range:
                        total_size = int(content_range.split("/")[-1])
                    etag = resp.headers.get("etag")
            except Exception: pass

        if not total_size:
            raise RuntimeError(f"Could not determine total size for chunked download: {url}")

        logger.info(f"Chunked download: total_size={total_size}, etag={etag}")

        # Ensure file exists and is empty if we are starting over
        with open(target_path, "wb"):
            pass

        start = 0
        while start < total_size:
            end = min(start + self.streaming_chunk_size - 1, total_size - 1)
            headers = {"Range": f"bytes={start}-{end}"}
            if etag:
                headers["If-Range"] = etag

            chunk_success = False
            for attempt in range(1, 4):
                try:
                    async with client.stream("GET", url, headers=headers) as resp:
                        if resp.status_code == 200:
                            # Server ignored range, gave us the whole file.
                            # Since we are starting from start, if start is 0, we can just take it.
                            # If start > 0, we are in trouble but let's just write it.
                            logger.warning(f"Server returned 200 for chunk {start}-{end}. Downloading whole file.")
                            with open(target_path, "wb") as f:
                                async for chunk in resp.aiter_bytes():
                                    f.write(chunk)
                            logger.info("Whole file downloaded via 200 response.")
                            return

                        if resp.status_code != 206:
                            resp.raise_for_status()

                        # Refresh etag if it changed
                        new_etag = resp.headers.get("etag")
                        if new_etag: etag = new_etag

                        with open(target_path, "ab") as f:
                            # Verify position
                            if f.tell() != start:
                                f.seek(start)
                                f.truncate()

                            bytes_written = 0
                            async for chunk in resp.aiter_bytes():
                                f.write(chunk)
                                bytes_written += len(chunk)

                            if bytes_written == (end - start + 1):
                                chunk_success = True
                                break
                            else:
                                logger.warning(f"Chunk truncated: {bytes_written}/{end-start+1}")
                except Exception as e:
                    logger.warning(f"Chunk {start}-{end} failed (attempt {attempt}): {e}")

                if not chunk_success:
                    await asyncio.sleep(1 * attempt)

            if not chunk_success:
                raise RuntimeError(f"Failed to download chunk {start}-{end} after 3 attempts")

            start = end + 1
            if start % (100 * 1024) < self.streaming_chunk_size:
                logger.info(f"Chunked download progress: {round(start/1024, 1)}KB / {round(total_size/1024, 1)}KB")

        logger.info("Chunked download completed", extra={"url": url})
