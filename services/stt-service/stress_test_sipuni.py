import asyncio
import os
import time
import logging
import sys

# Add src to sys.path to allow imports
sys.path.append(os.path.join(os.getcwd(), "services/stt-service"))

from src.infrastructure.audio.streaming_downloader import StreamingDownloader

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def run_stress_test():
    url = "https://sipuni.com/api/crm/record?id=1774941211.1253640&hash=cfdece8d82acc90df2427d7c0307afd2&user=017910"
    target_dir = "temp_downloads"
    os.makedirs(target_dir, exist_ok=True)

    downloader = StreamingDownloader(max_attempts=5)

    success_count = 0
    total_attempts = 50
    results = []

    logger.info(f"Starting stress test: {total_attempts} sequential downloads...")

    for i in range(1, total_attempts + 1):
        target_path = os.path.join(target_dir, f"test_{i}.mp3")
        start_time = time.monotonic()

        try:
            await downloader.download(url, target_path)
            duration = time.monotonic() - start_time
            file_size = os.path.getsize(target_path)

            logger.info(f"Download {i}/{total_attempts}: SUCCESS | Time: {duration:.2f}s | Size: {file_size} bytes")
            results.append({
                "attempt": i,
                "status": "SUCCESS",
                "duration": duration,
                "size": file_size
            })
            success_count += 1
        except Exception as e:
            duration = time.monotonic() - start_time
            logger.error(f"Download {i}/{total_attempts}: FAILED | Time: {duration:.2f}s | Error: {str(e)}")
            results.append({
                "attempt": i,
                "status": "FAILED",
                "duration": duration,
                "error": str(e)
            })

        # Cleanup
        if os.path.exists(target_path):
            os.remove(target_path)

    success_rate = (success_count / total_attempts) * 100
    logger.info(f"Stress test completed. Success Rate: {success_rate}% ({success_count}/{total_attempts})")

    if success_rate == 100:
        logger.info("GOAL ACHIEVED: 100% success rate reached!")
    else:
        logger.error(f"GOAL NOT ACHIEVED: Success rate is {success_rate}%")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_stress_test())
