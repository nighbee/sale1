import sys
import os
import asyncio
import time
import logging
from aiohttp import web

# Ensure the service root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.infrastructure.audio.streaming_downloader import StreamingDownloader

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Mock server that stalls
async def handle_download(request):
    file_size = 200 * 1024  # 200KB
    range_header = request.headers.get('Range')

    start = 0
    if range_header:
        # Simple range parsing
        start = int(range_header.replace('bytes=', '').split('-')[0])

    logger.info(f"Server: Received request for range {start}-")

    response = web.StreamResponse(
        status=206,
        reason='Partial Content',
        headers={
            'Content-Type': 'audio/mpeg',
            'Content-Range': f'bytes {start}-{file_size-1}/{file_size}',
            'Content-Length': str(file_size - start),
        }
    )
    await response.prepare(request)

    chunk_to_send = 16 * 1024 # 16KB

    # Send some data
    data = b'0' * chunk_to_send
    await response.write(data)
    logger.info(f"Server: Sent {len(data)} bytes starting at {start}")

    # Now stall for the first few attempts to simulate the issue
    # Or just stall always for a certain range to see if the client can recover

    stall_count = getattr(request.app, 'stall_count', 0)
    request.app.stall_count = stall_count + 1

    if stall_count < 3:
        logger.info(f"Server: Stalling attempt {stall_count}...")
        await asyncio.sleep(20) # Simulate a 20s stall
        # We don't close the connection, we just stop sending
    else:
        # Finally send the rest
        remaining = file_size - start - chunk_to_send
        if remaining > 0:
            await response.write(b'1' * remaining)
            logger.info(f"Server: Sent remaining {remaining} bytes")

    return response

async def run_mock_server():
    app = web.Application()
    app.stall_count = 0
    app.router.add_get('/audio.mp3', handle_download)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 8080)
    await site.start()
    return runner

async def main():
    runner = await run_mock_server()
    url = "http://localhost:8080/audio.mp3"
    target = "test_output.mp3"

    if os.path.exists(target):
        os.remove(target)
    if os.path.exists(target + ".tmp"):
        os.remove(target + ".tmp")

    downloader = StreamingDownloader(max_attempts=10, base_backoff=1.0)

    start_time = time.monotonic()
    try:
        # The current downloader has a 300s sock_read timeout.
        # Our mock server stalls for 20s.
        # If the downloader doesn't have a per-chunk timeout less than 20s,
        # it will wait 300s before timing out (if it even does).
        # Wait, if we want to REPRODUCE the "minutes" issue, we should see it taking a long time.

        # Actually, let's see if it even times out with a 20s stall when sock_read is 300s.
        # It shouldn't. It should just sit there.

        logger.info("Starting download...")
        await downloader.download(url, target)
        logger.info(f"Download finished in {time.monotonic() - start_time:.2f}s")
    except Exception as e:
        logger.error(f"Download failed: {e}")
    finally:
        await runner.cleanup()
        if os.path.exists(target):
            os.remove(target)
        if os.path.exists(target + ".tmp"):
            os.remove(target + ".tmp")

if __name__ == "__main__":
    asyncio.run(main())
