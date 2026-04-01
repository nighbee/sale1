import sys
import os
import asyncio

# Ensure the service root (parent of this tests/ folder) is on sys.path so
# imports like `src.infrastructure...` resolve when running the script directly.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.infrastructure.audio.playwright_downloader import PlaywrightDownloader
async def main():
    url = "https://sipuni.com/api/crm/record?id=1774952261.1264275&hash=d68c95bcbb0e15bff1d7e9944e835dcb&user=017910"
    downloader = PlaywrightDownloader()
    await downloader.download(url, "out.mp3")

asyncio.run(main())