import os
import pytest
import asyncio
from aiohttp import web
from src.infrastructure.audio.resilient_streaming_downloader import ResilientStreamingDownloader

# Mock Server to simulate various failure scenarios
class MockAudioServer:
    def __init__(self):
        self.app = web.Application()
        self.app.router.add_get('/audio', self.handle_audio)
        self.runner = None
        self.site = None
        self.content = b"a" * 1024 * 100 # 100KB of 'audio'
        self.etag = "v1"
        self.fail_at = None
        self.fail_count = 0
        self.total_size_override = None
        self.received_ranges = []

    async def handle_audio(self, request):
        range_header = request.headers.get('Range')
        if range_header:
            self.received_ranges.append(range_header)

        if self.fail_at and self.fail_count < 1:
            self.fail_count += 1
            # Simulate a stall/disconnect
            resp = web.StreamResponse(status=200, headers={'ETag': self.etag})
            await resp.prepare(request)
            await resp.write(self.content[:self.fail_at])
            # Force close without finishing
            request.transport.close()
            return resp

        start = 0
        if range_header:
            # Simple Range parser: bytes=0-
            try:
                start = int(range_header.replace('bytes=', '').split('-')[0])
            except:
                start = 0

        content = self.content[start:]
        total = self.total_size_override or len(self.content)

        headers = {
            'ETag': self.etag,
            'Content-Type': 'audio/mpeg',
        }

        if range_header:
            headers['Content-Range'] = f"bytes {start}-{total-1}/{total}"
            headers['Content-Length'] = str(len(content))
            return web.Response(body=content, status=206, headers=headers)

        headers['Content-Length'] = str(total)
        return web.Response(body=content, status=200, headers=headers)

    async def start(self):
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, '127.0.0.1', 0)
        await self.site.start()
        return self.site._server.sockets[0].getsockname()

    async def stop(self):
        if self.runner:
            await self.runner.cleanup()

@pytest.mark.asyncio
async def test_successful_download(tmp_path):
    server = MockAudioServer()
    addr = await server.start()
    url = f"http://{addr[0]}:{addr[1]}/audio"

    target = str(tmp_path / "test.mp3")
    downloader = ResilientStreamingDownloader(min_file_size=100)

    try:
        await downloader.download(url, target)
        assert os.path.exists(target)
        assert os.path.getsize(target) == len(server.content)
    finally:
        await server.stop()

@pytest.mark.asyncio
async def test_resume_after_failure(tmp_path):
    server = MockAudioServer()
    addr = await server.start()
    url = f"http://{addr[0]}:{addr[1]}/audio"

    server.fail_at = 50 * 1024 # Fail at 50KB
    target = str(tmp_path / "test_resume.mp3")
    downloader = ResilientStreamingDownloader(min_file_size=100, base_backoff=0.1)

    try:
        await downloader.download(url, target)
        assert os.path.exists(target)
        assert os.path.getsize(target) == len(server.content)
        # Verify that Range was actually sent for resume.
        # Note: with 16KB chunk size, it might not be exactly 51200 if fail_at was at 50KB.
        # aiohttp's iter_chunked(16384) will read 3 full chunks (49152 bytes) and then fail on the 4th.
        # So it will likely resume from 49152.
        assert any("bytes=" in r and "- " not in r for r in server.received_ranges)
        assert any(int(r.replace('bytes=', '').split('-')[0]) > 0 for r in server.received_ranges)
    finally:
        await server.stop()

@pytest.mark.asyncio
async def test_restart_on_etag_change(tmp_path):
    server = MockAudioServer()
    addr = await server.start()
    url = f"http://{addr[0]}:{addr[1]}/audio"

    server.fail_at = 50 * 1024
    target = str(tmp_path / "test_etag.mp3")
    downloader = ResilientStreamingDownloader(min_file_size=100, base_backoff=0.1)

    original_sleep = asyncio.sleep
    async def mocked_sleep(delay):
        server.etag = "v2" # Change ETag during backoff
        await original_sleep(delay)

    import unittest.mock as mock
    try:
        with mock.patch('asyncio.sleep', side_effect=mocked_sleep):
            await downloader.download(url, target)
        assert os.path.exists(target)
        assert os.path.getsize(target) == len(server.content)
        # Check if the server received a request WITH range after failure, then handled ETag mismatch
        assert any(int(r.replace('bytes=', '').split('-')[0]) > 0 for r in server.received_ranges)
    finally:
        await server.stop()

@pytest.mark.asyncio
async def test_html_detection(tmp_path):
    server = MockAudioServer()
    addr = await server.start()
    url = f"http://{addr[0]}:{addr[1]}/audio"

    server.content = b"<!DOCTYPE html><html><body>Error</body></html>"
    target = str(tmp_path / "test_html.mp3")
    downloader = ResilientStreamingDownloader(min_file_size=10)

    try:
        with pytest.raises(Exception) as excinfo:
            await downloader.download(url, target)
        assert "Detected HTML" in str(excinfo.value)
    finally:
        await server.stop()
