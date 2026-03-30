import asyncio
import os
import logging
import tempfile
from src.infrastructure.audio.http_downloader import HTTPDownloader
from src.infrastructure.audio.curl_downloader import CurlDownloader

# Set up logging to see our detailed logs
logging.basicConfig(level=logging.DEBUG, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def verify_sipuni_extraction():
    url = "https://sipuni.com/api/crm/record?id=123&hash=abc-xyz&user=testuser"

    logger.info("Verifying Sipuni cookie extraction in HTTPDownloader...")
    http = HTTPDownloader()
    cookies = http._extract_cookies(url)
    assert cookies["hcode"] == "abc-xyz", f"Expected abc-xyz, got {cookies.get('hcode')}"
    assert cookies["user"] == "testuser", f"Expected testuser, got {cookies.get('user')}"
    logger.info("HTTPDownloader cookie extraction: OK")

    logger.info("Verifying Sipuni cookie extraction in CurlDownloader...")
    curl = CurlDownloader()
    cookie_str = curl._extract_cookies(url)
    assert "hcode=abc-xyz" in cookie_str, f"Expected hcode=abc-xyz in {cookie_str}"
    assert "user=testuser" in cookie_str, f"Expected user=testuser in {cookie_str}"
    logger.info("CurlDownloader cookie extraction: OK")

async def test_real_http_download():
    # Use a reliable public file for testing
    url = "https://raw.githubusercontent.com/mathiasbynens/he/master/README.md"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".md") as tmp:
        tmp_path = tmp.name

    try:
        logger.info(f"Testing real HTTP download from {url}")
        http = HTTPDownloader(min_file_size=100) # Lower min size for this small file
        await http.download(url, tmp_path)

        if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
            logger.info(f"HTTP download successful. Size: {os.path.getsize(tmp_path)} bytes")
            with open(tmp_path, "r") as f:
                content = f.read(20)
                logger.info(f"Content preview: {content}")
        else:
            logger.error("HTTP download failed: File empty or not found")
    except Exception as e:
        logger.error(f"HTTP download failed: {e}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

async def main():
    await verify_sipuni_extraction()
    await test_real_http_download()

if __name__ == "__main__":
    asyncio.run(main())
