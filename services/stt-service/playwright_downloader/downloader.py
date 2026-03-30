import os
import sys
import logging
import argparse
import time
from typing import List, Dict, Optional
from playwright.sync_api import sync_playwright, Browser, BrowserContext, APIResponse

# Add current dir to sys.path for absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.cookies import load_cookies
from utils.retry import retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class DownloadError(Exception):
    """Custom exception for download failures."""
    pass

class PlaywrightDownloader:
    def __init__(
        self,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        timeout_ms: int = 60000,
        proxy: Optional[Dict[str, str]] = None
    ):
        self.user_agent = user_agent
        self.timeout_ms = timeout_ms
        self.proxy = proxy

    @retry(max_attempts=3, base_delay=2.0, exceptions=(DownloadError, Exception))
    def download(self, url: str, output_path: str, cookies: Optional[List[Dict]] = None) -> None:
        """
        Downloads a file using Playwright's browser context.
        """
        logger.info(f"Starting download from {url}")
        start_time = time.monotonic()

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, proxy=self.proxy)

            # Create a context with realistic headers and viewport
            context = browser.new_context(
                user_agent=self.user_agent,
                viewport={'width': 1920, 'height': 1080},
                locale="en-US",
                extra_http_headers={
                    "Accept": "audio/mpeg,audio/*;q=0.9,application/octet-stream;q=0.8,*/*;q=0.7",
                    "Accept-Language": "en-US,en;q=0.9",
                }
            )

            if cookies:
                logger.info(f"Injecting {len(cookies)} cookies")
                context.add_cookies(cookies)

            try:
                # Use context.request to perform a direct binary fetch within the browser session
                # This inherits the context's cookies and headers
                response: APIResponse = context.request.get(url, timeout=self.timeout_ms)

                if not response:
                    raise DownloadError("Received empty response from browser context")

                status = response.status
                logger.info(f"HTTP Status: {status}")

                if status != 200:
                    raise DownloadError(f"Failed to download: HTTP {status}")

                body = response.body()
                file_size = len(body)

                if file_size == 0:
                    raise DownloadError("Downloaded file is empty (0 bytes)")

                # Save binary data
                with open(output_path, 'wb') as f:
                    f.write(body)

                duration = time.monotonic() - start_time
                speed = (file_size / 1024) / duration if duration > 0 else 0

                logger.info(
                    f"Download successful! "
                    f"Size: {file_size} bytes, "
                    f"Time: {duration:.2f}s, "
                    f"Speed: {speed:.2f} KB/s"
                )

            except Exception as e:
                logger.error(f"Download failed: {str(e)}")
                raise DownloadError(str(e))
            finally:
                context.close()
                browser.close()

def main():
    parser = argparse.ArgumentParser(description="Reliable media downloader using Playwright.")
    parser.add_argument("--url", required=True, help="Full URL of the media file.")
    parser.add_argument("--output", required=True, help="Output file path (e.g., record.mp3).")
    parser.add_argument("--cookies", help="Path to cookies.json file.")
    parser.add_argument("--proxy", help="Proxy server URL (e.g., http://user:pass@host:port).")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout in seconds (default: 60).")

    args = parser.parse_args()

    # Load cookies if provided
    cookies_data = None
    if args.cookies:
        cookies_data = load_cookies(args.cookies)

    # Setup proxy if provided
    proxy_config = None
    if args.proxy:
        proxy_config = {"server": args.proxy}

    downloader = PlaywrightDownloader(
        timeout_ms=args.timeout * 1000,
        proxy=proxy_config
    )

    try:
        downloader.download(args.url, args.output, cookies=cookies_data)
        print(f"Successfully downloaded to {args.output}")
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
