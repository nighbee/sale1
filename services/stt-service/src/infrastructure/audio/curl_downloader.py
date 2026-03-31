import asyncio
import logging
import os
import time
from typing import List, Optional, Dict
from urllib.parse import urlparse, parse_qs
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class CurlDownloader(AudioDownloader):
    def __init__(self, timeout_s: int = 300, max_retries: int = 5):
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self.user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"

    def _extract_cookies(self, url: str) -> str:
        """
        Extracts cookies from URL parameters for Sipuni and formats them for curl.
        """
        cookies = []
        try:
            parsed_url = urlparse(url)
            params = parse_qs(parsed_url.query)

            if "sipuni.com" in parsed_url.netloc:
                if "hash" in params:
                    cookies.append(f"hcode={params['hash'][0]}")
                if "user" in params:
                    cookies.append(f"user={params['user'][0]}")
        except Exception as e:
            logger.warning(f"Failed to extract cookies for Curl: {e}")

        return "; ".join(cookies)

    async def download(self, url: str, target_path: str) -> None:
        """
        Downloads audio using the curl command line tool with resilient flags and browser headers.
        """
        logger.info("Starting resilient download with curl", extra={"url": url, "target_path": target_path})
        start_time = time.monotonic()
        
        cookie_header = self._extract_cookies(url)

        # -L: follow redirects
        # -C -: Auto-resume from file size
        # --fail: fail on HTTP errors
        # --connect-timeout: max time for connection
        # --max-time: max time for the entire operation
        # --speed-limit 100 --speed-time 20: abort if < 100 bytes/sec for 20s
        # -v: verbose (logs headers to stderr)

        cmd = [
            "curl",
            "-L",
            "-C", "-", 
            "-o", target_path,
            "--fail",
            "--connect-timeout", "15",
            "--max-time", str(self.timeout_s),
            "--speed-limit", "100",
            "--speed-time", "20",
            "--http1.1",
            "--retry", str(self.max_retries),
            "--retry-delay", "5",
            "--retry-all-errors",
            "--user-agent", self.user_agent,
            "--compressed",
            "-H", "Accept: */*",
            "-H", "Accept-Encoding: identity;q=1, *;q=0",
            "-H", "sec-fetch-dest: video",
            "-H", "Cache-Control: no-cache",
            "-H", "Pragma: no-cache",
            "-v",
            url
        ]

        if cookie_header:
            cmd.extend(["--cookie", cookie_header])

        logger.debug(f"Executing: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()
            duration = time.monotonic() - start_time

            if process.returncode != 0:
                error_msg = stderr.decode().strip()
                # Special handling for "Operation too slow"
                if "Operation too slow" in error_msg or process.returncode == 28:
                    logger.error("Curl stalled even with lenient timeouts", extra={"url": url, "stderr": error_msg})
                
                raise RuntimeError(f"Curl failed (code {process.returncode}): {error_msg}")

            file_size = os.path.getsize(target_path) if os.path.exists(target_path) else 0

            # Simple HTML check
            if file_size < 1024:
                with open(target_path, "rb") as f:
                    content = f.read().lower()
                    if b"<html>" in content or b"<!doctype html>" in content:
                        os.remove(target_path)
                        raise RuntimeError(f"Curl downloaded HTML instead of audio from {url}")

            logger.info(
                "Curl download completed",
                extra={
                    "url": url, 
                    "size_bytes": file_size, 
                    "duration_s": round(duration, 2),
                    "speed_kbps": round((file_size / 1024) / duration, 2) if duration > 0 else 0
                }
            )

        except Exception as e:
            logger.error("Execution error in CurlDownloader", extra={"url": url, "error": str(e)})
            raise
