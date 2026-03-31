import asyncio
import os
import time
import logging
import sys

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from src.infrastructure.audio.playwright_downloader import PlaywrightDownloader

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("test_50_downloads")

# Use the URL provided by the user in the prompt
URL = "https://sipuni.com/api/crm/record?id=1774935432.1246762&hash=f47f36f305edba3bede4bffa0824fdcf&user=017910"
ATTEMPTS = 50
OUTPUT_DIR = "test_downloads_50"

async def test_download(attempt: int, downloader: PlaywrightDownloader):
    target_path = os.path.join(OUTPUT_DIR, f"download_{attempt}.mp3")
    start_time = time.monotonic()

    try:
        await downloader.download(URL, target_path)
        duration = time.monotonic() - start_time
        file_size = os.path.getsize(target_path)
        logger.info(f"Attempt {attempt}: SUCCESS | Duration: {duration:.2f}s | Size: {file_size} bytes")
        return True, duration, file_size
    except Exception as e:
        duration = time.monotonic() - start_time
        logger.error(f"Attempt {attempt}: FAILED  | Duration: {duration:.2f}s | Error: {str(e)}")
        return False, duration, 0

async def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Use default settings for PlaywrightDownloader
    downloader = PlaywrightDownloader()

    results = []
    logger.info(f"Starting {ATTEMPTS} download attempts for Sipuni URL using PlaywrightDownloader...")

    for i in range(1, ATTEMPTS + 1):
        success, duration, size = await test_download(i, downloader)
        results.append((success, duration, size))
        # Small delay between attempts to be nice but still testing frequency
        await asyncio.sleep(0.5)

    success_count = sum(1 for r in results if r[0])
    logger.info("-" * 50)
    logger.info(f"Final Results: {success_count}/{ATTEMPTS} successful")

    if success_count > 0:
        avg_duration = sum(r[1] for r in results if r[0]) / success_count
        sizes = [r[2] for r in results if r[0]]
        logger.info(f"Average Duration: {avg_duration:.2f}s")
        logger.info(f"Unique Sizes: {set(sizes)}")

    if success_count == ATTEMPTS:
        logger.info("Reliability check: PASSED (100% success rate)")
    else:
        logger.warning(f"Reliability check: FAILED ({success_count}/{ATTEMPTS} success rate)")

if __name__ == "__main__":
    asyncio.run(main())
