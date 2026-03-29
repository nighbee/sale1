import asyncio
import logging
import os
import subprocess
from src.core.ports.audio_downloader import AudioDownloader

logger = logging.getLogger(__name__)

class CurlDownloader(AudioDownloader):
    def __init__(self, timeout_s: int = 300):
        self.timeout_s = timeout_s

    async def download(self, url: str, target_path: str) -> None:
        """
        Downloads audio using the curl command line tool.
        """
        logger.info("Starting download with curl", extra={"url": url, "target_path": target_path})

        # -L: follow redirects
        # -o: output file
        # -s: silent mode (no progress meter, but we might want it for logs?)
        # --fail: fail on HTTP errors
        # --connect-timeout: max time for connection
        # --max-time: max time for the entire operation
        # -v: verbose (logs headers to stderr)

        cmd = [
            "curl",
            "-L",
            "-o", target_path,
            "--fail",
            "--connect-timeout", "10",
            "--max-time", str(self.timeout_s),
            "-v",
            url
        ]

        try:
            # We use asyncio.create_subprocess_exec to not block the event loop
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode().strip()
                logger.error(
                    "Curl download failed",
                    extra={
                        "url": url,
                        "return_code": process.returncode,
                        "error": error_msg
                    }
                )
                raise RuntimeError(f"Curl download failed with code {process.returncode}: {error_msg}")

            # Log some of the stderr (headers) if useful
            logger.info(
                "Curl download completed successfully",
                extra={"url": url, "file_size": os.path.getsize(target_path)}
            )

        except Exception as e:
            logger.error("Error executing curl", extra={"url": url, "error": str(e)})
            raise
