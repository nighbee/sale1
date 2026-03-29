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
    url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
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

async def test_minio_download():
    # This might fail if MinIO is not running or accessible, but let's see if it initializes
    url = "minio://audio/test.wav"
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

    try:
        logger.info(f"Testing MinIO download initialization for {url}")
        downloader = DownloaderFactory.create(url)
        # We won't actually call download unless we are sure MinIO is up,
        # but let's try it and catch the error to see if it routes correctly.
        try:
            await downloader.download(url, tmp_path)
        except Exception as e:
            logger.info(f"MinIO download failed as expected (or due to env): {e}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

async def main():
    await test_http_download()
    await test_minio_download()

if __name__ == "__main__":
    asyncio.run(main())
