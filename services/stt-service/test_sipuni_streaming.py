import asyncio
import os
import time
import logging
import sys

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from src.infrastructure.audio.streaming_downloader import StreamingDownloader

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("test_sipuni_streaming")

URL = "https://sipuni.com/api/crm/record?id=1774941624.1254309&hash=ca62ae07a148d931c7804ee8098c254e&user=017910"
ATTEMPTS = 5 # Reduced for session warming tests to save time
OUTPUT_DIR = "test_downloads"

async def test_download(attempt: int, downloader: StreamingDownloader):
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

    downloader = StreamingDownloader(max_attempts=3) # Use fewer internal retries for this test to see actual results per attempt

    results = []
    logger.info(f"Starting {ATTEMPTS} download attempts for Sipuni URL...")

    for i in range(1, ATTEMPTS + 1):
        success, duration, size = await test_download(i, downloader)
        results.append((success, duration, size))
        # Small delay between attempts
        await asyncio.sleep(1)

    success_count = sum(1 for r in results if r[0])
    logger.info("-" * 50)
    logger.info(f"Results: {success_count}/{ATTEMPTS} successful")

    if success_count > 0:
        avg_duration = sum(r[1] for r in results if r[0]) / success_count
        sizes = [r[2] for r in results if r[0]]
        logger.info(f"Average Duration: {avg_duration:.2f}s")
        logger.info(f"Sizes: {sizes}")
        if len(set(sizes)) == 1:
            logger.info("Consistency check: PASSED (all files have same size)")
        else:
            logger.warning(f"Consistency check: FAILED (different sizes detected: {set(sizes)})")
    else:
        logger.error("All attempts failed!")

if __name__ == "__main__":
    asyncio.run(main())
