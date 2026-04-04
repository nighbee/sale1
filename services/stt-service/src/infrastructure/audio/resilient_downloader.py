import logging
import asyncio
import os
import time
from typing import List, Optional
from src.core.ports.audio_downloader import AudioDownloader
from src.infrastructure.audio.resilient_streaming_downloader import ResilientStreamingDownloader
from src.infrastructure.audio.curl_downloader import CurlDownloader

logger = logging.getLogger(__name__)

class ResilientDownloader(AudioDownloader):
    """
    Orchestrates a robust download pipeline specifically designed for 
    unreliable upstream B2B APIs (like Sipuni) that stall mid-stream.
    """
    def __init__(
        self, 
        max_total_attempts: int = 5,
        initial_delay: float = 2.0,
        max_duration_s: int = 600
    ):
        self.max_total_attempts = max_total_attempts
        self.initial_delay = initial_delay
        self.max_duration_s = max_duration_s
        self.streaming = ResilientStreamingDownloader(max_attempts_per_file=1) # One attempt per internal retry
        self.curl = CurlDownloader(timeout_s=max_duration_s)

    async def download(self, url: str, target_path: str) -> None:
        """
        Executes the resilient pipeline:
        1. Streaming with Range/Resume (Smart)
        2. Fallback to Curl (Resilient) with local resume
        3. Adaptive delays to handle 'Eventually Ready' files
        """
        attempt = 0
        last_error = None

        while attempt < self.max_total_attempts:
            attempt += 1
            start_time = time.monotonic()
            
            # 1. Decide which downloader to use
            # Prefer ResilientStreamingDownloader for the first couple of tries, then switch to Curl
            if attempt <= 2:
                downloader = self.streaming
                name = "STREAMING_SMART"
            else:
                downloader = self.curl
                name = "CURL_RESILIENT"

            try:
                logger.info(
                    f"Resilient attempt {attempt}/{self.max_total_attempts} using {name}",
                    extra={"url": url, "path": target_path}
                )
                
                # Check if we should wait (maybe file is still being generated)
                if attempt > 1:
                    wait_time = self.initial_delay * (1.5 ** (attempt - 2))
                    logger.debug(f"Waiting {wait_time:.1f}s for upstream generation...", extra={"url": url})
                    await asyncio.sleep(wait_time)

                await downloader.download(url, target_path)
                
                # Success!
                return

            except Exception as e:
                last_error = e
                duration = time.monotonic() - start_time
                
                logger.warning(
                    f"{name} attempt {attempt} failed after {duration:.1f}s",
                    extra={
                        "url": url,
                        "error_type": type(e).__name__,
                        "error_msg": str(e)
                    }
                )

                # Special Case: If file doesn't exist yet (404), maybe wait longer
                if "404" in str(e):
                    await asyncio.sleep(5.0)

        error_summary = f"Resilient pipeline exhausted {self.max_total_attempts} attempts. Last error: {str(last_error)}"
        logger.error(error_summary, extra={"url": url})
        raise RuntimeError(error_summary) from last_error
