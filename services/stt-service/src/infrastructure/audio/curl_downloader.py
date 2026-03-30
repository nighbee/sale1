import asyncio
import logging
import os
import time
from typing import List, Optional
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class CurlDownloader(AudioDownloader):
    def __init__(self, timeout_s: int = 300, max_retries: int = 5):
        self.timeout_s = timeout_s
        self.max_retries = max_retries

    async def download(self, url: str, target_path: str) -> None:
        """
        Downloads audio using the curl command line tool with resilient flags.
        """
        logger.info("Starting resilient download with curl", extra={"url": url, "target_path": target_path})
        start_time = time.monotonic()
        
        # -L: follow redirects
        # -C -: Auto-resume from file size
        # --fail: fail on HTTP errors
        # --connect-timeout: max time for connection
        # --max-time: max time for the entire operation
        # --speed-limit 1 --speed-time 60: abort only if < 1 byte/sec for 60s (very tolerant)
        # -v: verbose (logs headers to stderr)

        cmd = [
            "curl",
            "-L",
            "-C", "-", 
            "-o", target_path,
            "--fail",
            "--connect-timeout", "15",
            "--max-time", str(self.timeout_s),
            "--speed-limit", "1",
            "--speed-time", "60",
            "--http1.1",
            "--retry", str(self.max_retries),
            "--retry-delay", "5",
            "--retry-all-errors",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "--compressed",
            "-v",
            url
        ]

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
