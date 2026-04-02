import os
import asyncio
import pytest
from aiohttp import web
from src.infrastructure.audio.streaming_downloader import StreamingDownloader, DownloadError

# Helper to create a dummy server that disconnects mid-download
async def create_dummy_server(total_size=10000, disconnect_at=5000):
    content = b"x" * total_size

    async def handle_request(request):
        range_header = request.headers.get("Range")
        start_byte = 0
        if range_header:
            start_byte = int(range_header.replace("bytes=", "").split("-")[0])

        headers = {
            "Content-Type": "audio/mpeg",
            "Accept-Ranges": "bytes",
        }

        # If we are resuming, return 206
        if start_byte > 0:
            end_byte = total_size - 1
            headers["Content-Range"] = f"bytes {start_byte}-{end_byte}/{total_size}"
            headers["Content-Length"] = str(total_size - start_byte)
            response = web.StreamResponse(status=206, headers=headers)
            await response.prepare(request)

            # Send the rest of the data
            await response.write(content[start_byte:])
            return response
        else:
            # First request: send some data then disconnect
            headers["Content-Length"] = str(total_size)
            response = web.StreamResponse(status=200, headers=headers)
            await response.prepare(request)

            chunk_to_send = content[:disconnect_at]
            await response.write(chunk_to_send)

            # Simulate a disconnect (closing the connection before finishing)
            # In a real aiohttp server, this might be tricky to force exactly,
            # but we can try to raise an error or just return.
            # Returning here might just end the response gracefully if we don't
            # indicate more data is coming, but we set Content-Length=total_size
            # so the client should expect more.
            return response

    app = web.Application()
    app.add_routes([web.get("/download", handle_request)])
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", 8080)
    await site.start()
    return runner

@pytest.mark.asyncio
async def test_streaming_resume():
    total_size = 10000
    disconnect_at = 4000
    runner = await create_dummy_server(total_size, disconnect_at)

    target_path = "test_resume.mp3"
    if os.path.exists(target_path):
        os.remove(target_path)
    if os.path.exists(target_path + ".tmp"):
        os.remove(target_path + ".tmp")

    try:
        downloader = StreamingDownloader(chunk_size=1024, max_attempts=3, base_backoff=0.1)
        url = "http://localhost:8080/download"

        # The first attempt will get 4000 bytes, then "finish" (server returns)
        # However, because Content-Length was 10000, downloader should see it's incomplete
        # and retry with Range: bytes=4000-

        await downloader.download(url, target_path)

        assert os.path.exists(target_path)
        assert os.path.getsize(target_path) == total_size

        # Verify content
        with open(target_path, "rb") as f:
            data = f.read()
            assert data == b"x" * total_size

    finally:
        await runner.cleanup()
        if os.path.exists(target_path):
            os.remove(target_path)
        if os.path.exists(target_path + ".tmp"):
            os.remove(target_path + ".tmp")

if __name__ == "__main__":
    asyncio.run(test_streaming_resume())
