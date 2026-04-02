import os
import asyncio
import pytest
import logging
from aiohttp import web
from src.infrastructure.audio.streaming_downloader import StreamingDownloader, DownloadError

# Setup logging to see what's happening during tests
logging.basicConfig(level=logging.INFO)

class MockServer:
    def __init__(self):
        self.total_size = 1000
        self.content = bytes([i % 256 for i in range(self.total_size)])
        self.request_count = 0

    async def handle_request(self, request):
        self.request_count += 1
        range_header = request.headers.get("Range")

        if not range_header:
            return web.Response(status=200, body=self.content)

        # Parse requested start
        try:
            start_byte = int(range_header.replace("bytes=", "").split("-")[0])
        except (ValueError, IndexError):
            return web.Response(status=400)

        if start_byte >= self.total_size:
            return web.Response(status=416, headers={"Content-Range": f"bytes */{self.total_size}"})

        # Scenario 1: First request (offset 0) returns 100 bytes and then "disconnects"
        if self.request_count == 1 and start_byte == 0:
            end_byte = 199 # Intent: send bytes 0-199
            headers = {
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Content-Range": f"bytes 0-{end_byte}/{self.total_size}",
                "Content-Length": "200"
            }
            response = web.StreamResponse(status=206, headers=headers)
            await response.prepare(request)
            # Only write 50 bytes and then return (simulating failure/partial)
            await response.write(self.content[0:50])
            # We don't close, just return. aiohttp will finish the response.
            # From the client's perspective, it expected 200 bytes but got 50.
            return response

        # Scenario 2: Retry of first request (client should ask for offset 0 again if we want to test same range retry)
        # BUT our downloader updates next_start = end + 1 if the request finishes without exception.
        # If we returned from handle_request, aiohttp might finish it cleanly.
        # Let's force an actual failure by raising an exception or just closing.

        # Scenario 3: Regular 206 responses
        end_byte = min(start_byte + 200, self.total_size - 1)
        headers = {
            "Content-Type": "audio/mpeg",
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start_byte}-{end_byte}/{self.total_size}",
            "Content-Length": str(end_byte - start_byte + 1)
        }
        return web.Response(status=206, body=self.content[start_byte:end_byte+1], headers=headers)

@pytest.mark.asyncio
async def test_ranged_logic_resilience():
    server_logic = MockServer()
    app = web.Application()
    app.add_routes([web.get("/download", server_logic.handle_request)])
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", 8081)
    await site.start()

    target_path = "test_ranged.mp3"
    if os.path.exists(target_path): os.remove(target_path)
    if os.path.exists(target_path + ".tmp"): os.remove(target_path + ".tmp")

    try:
        # Use small min_file_size to allow our 1000 byte "audio"
        downloader = StreamingDownloader(chunk_size=10, max_attempts=5, base_backoff=0.1, min_file_size=100)
        url = "http://localhost:8081/download"

        await downloader.download(url, target_path)

        assert os.path.exists(target_path)
        assert os.path.getsize(target_path) == server_logic.total_size

        with open(target_path, "rb") as f:
            downloaded_content = f.read()
            assert downloaded_content == server_logic.content

    finally:
        await runner.cleanup()
        if os.path.exists(target_path): os.remove(target_path)
        if os.path.exists(target_path + ".tmp"): os.remove(target_path + ".tmp")

if __name__ == "__main__":
    asyncio.run(test_ranged_logic_resilience())
