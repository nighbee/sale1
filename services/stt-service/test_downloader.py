import asyncio
import os
import logging
import tempfile
from src.core.ports.downloader_factory import DownloaderFactory

# Set up logging to see our detailed logs
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def test_http_download():
    # Use a reliable public file for testing
    url = "https://raw.githubusercontent.com/mathiasbynens/he/master/README.md"
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

    try:
        logger.info(f"Testing HTTP download from {url}")
        downloader = DownloaderFactory.create(url)
        await downloader.download(url, tmp_path)

        if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
            logger.info(f"HTTP download successful. Size: {os.path.getsize(tmp_path)} bytes")
        else:
            logger.error("HTTP download failed: File empty or not found")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

async def test_curl_download():
    # Use a reliable public file for testing
    url = "https://raw.githubusercontent.com/mathiasbynens/he/master/README.md"
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

    try:
        logger.info(f"Testing Curl download from {url}")
        os.environ["STT_DOWNLOAD_STRATEGY"] = "curl"
        downloader = DownloaderFactory.create(url)
        await downloader.download(url, tmp_path)

        if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
            logger.info(f"Curl download successful. Size: {os.path.getsize(tmp_path)} bytes")
        else:
            logger.error("Curl download failed: File empty or not found")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        if "STT_DOWNLOAD_STRATEGY" in os.environ:
            del os.environ["STT_DOWNLOAD_STRATEGY"]

async def main():
    await test_http_download()
    await test_curl_download()

if __name__ == "__main__":
    asyncio.run(main())
