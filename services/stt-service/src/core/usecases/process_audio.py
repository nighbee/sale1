import os
import json
import httpx
import asyncio
import logging
import tempfile
import time
from urllib.parse import urlparse
from src.adapters.storage.postgres_repo import save_transcript, update_call_link
from src.adapters.events.redis_publisher import publish_transcript_ready
from src.adapters.storage.minio_client import MinioClient
from src.infrastructure.audio.diarization import DiarizationService, merge_transcript_with_diarization
from src.infrastructure.audio.converter import AudioConverter
from src.adapters.stt.openai_provider import OpenAISTTProvider
from src.adapters.stt.gemini_provider import GeminiSTTProvider
from src.adapters.stt.groq_provider import GroqSTTProvider
from src.adapters.stt.deepgram_provider import DeepgramSTTProvider
from src.infrastructure.api.main_api_client import MainAPIClient

logger = logging.getLogger(__name__)

class ProcessAudioUseCase:
    def __init__(self):
        self.stt_local_url = os.getenv("LOCAL_STT_URL", "http://localhost:5001")
        self.minio = MinioClient()
        self.diarization_service = DiarizationService()
        self.api_client = MainAPIClient()
        
        # We will initialize provider on each execute to handle dynamic credentials
        self.stt_provider_name = os.getenv("STT_PROVIDER", "openai")

    def _get_stt_provider(self, integrations: list):
        provider_name = self.stt_provider_name

        # Look for integration that matches provider_name
        integration = next((i for i in integrations if i.get("integration_type") == provider_name), None)

        api_key = None
        if integration:
            creds = integration.get("credentials", {})
            if isinstance(creds, str):
                try:
                    creds = json.loads(creds)
                except:
                    pass
            if isinstance(creds, dict):
                api_key = creds.get("api_key")

        logger.info(
            "Initializing STT provider",
            extra={
                "provider": provider_name,
                "has_integration": integration is not None,
                "has_api_key": api_key is not None and len(api_key) > 0 if api_key else False,
            },
        )

        if provider_name == "gemini":
            return GeminiSTTProvider(api_key=api_key)
        elif provider_name == "groq":
            return GroqSTTProvider(api_key=api_key)
        elif provider_name == "deepgram":
            return DeepgramSTTProvider(api_key=api_key)
        else:
            return OpenAISTTProvider(api_key=api_key)

    async def _download_with_resume(
        self,
        url: str,
        target_path: str,
        max_attempts: int = 2,
        base_backoff: float = 5.0,
        chunk_size: int = 15 * 1024,
        split_fallback: bool = True,
    ) -> None:
        """
        Download a file with resumption support using Range headers.
        Uses HTTP/1.1 to avoid HTTP/2 flow control issues.
        Persists cookies across attempts.
        If resuming fails (server returns 200 instead of 206), falls back to
        splitting the download into small chunks if split_fallback is True.
        """
        # Create a client with HTTP/1.1 forced and cookie jar
        async with httpx.AsyncClient(
            http2=False,  # force HTTP/1.1
            timeout=httpx.Timeout(10.0, read=30.0),
            follow_redirects=True,
        ) as client:
            # If this is the problematic host that stalls on long streams,
            # bypass long-lived connection streaming and download in small
            # fixed-size chunks using separate requests so each chunk completes
            # before the per-connection cap is hit.
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            if "sipuni.com" in host:
                logger.info(
                    "Using chunked-only download for problematic host",
                    extra={"url": url, "host": host, "chunk_size": chunk_size},
                )
                # Use the same client (preserve cookies/session) and a small
                # chunk size (default 15 KB) to avoid per-connection limits.
                await self._download_in_chunks(url, target_path, client, chunk_size=chunk_size)
                return

            for attempt in range(1, max_attempts + 1):
                try:
                    start_byte = 0
                    if os.path.exists(target_path):
                        start_byte = os.path.getsize(target_path)
                    total_size = None

                    headers = {}
                    if start_byte > 0:
                        headers["Range"] = f"bytes={start_byte}-"

                    logger.info(
                        f"Download attempt {attempt}/{max_attempts}",
                        extra={"url": url, "start_byte": start_byte, "attempt": attempt}
                    )

                    async with client.stream("GET", url, headers=headers) as response:
                        response.raise_for_status()
                        status = response.status_code
                        content_length = response.headers.get("content-length")
                        content_range = response.headers.get("content-range")
                        accept_ranges = response.headers.get("accept-ranges")

                        logger.info(
                            "Download response headers",
                            extra={
                                "status": status,
                                "content_length": content_length,
                                "content_range": content_range,
                                "accept_ranges": accept_ranges,
                                "attempt": attempt,
                            }
                        )

                        if status == 206 and content_range:
                            try:
                                total_size = int(content_range.split("/")[-1])
                            except Exception:
                                total_size = None
                        elif status == 200 and content_length:
                            try:
                                total_size = int(content_length)
                            except Exception:
                                total_size = None

                        mode = "ab" if start_byte > 0 else "wb"
                        with open(target_path, mode) as f:
                            bytes_downloaded = 0
                            async for chunk in response.aiter_bytes():
                                f.write(chunk)
                                bytes_downloaded += len(chunk)

                        current_size = os.path.getsize(target_path)
                        if total_size is not None and current_size >= total_size:
                            logger.info(
                                "Download completed successfully",
                                extra={"total_bytes": current_size, "attempt": attempt}
                            )
                            return

                        logger.warning(
                            "Partial transfer, need more attempts",
                            extra={
                                "current_size": current_size,
                                "expected": total_size,
                                "attempt": attempt,
                            }
                        )

                except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.HTTPError, Exception) as exc:
                    import traceback as _traceback
                    tb = _traceback.format_exc()
                    logger.warning(
                        f"Download attempt {attempt} failed",
                        extra={"url": url, "error": tb, "attempt": attempt}
                    )
                    if attempt == max_attempts:
                        if split_fallback:
                            logger.warning(
                                "Resuming failed, falling back to chunked download",
                                extra={"url": url}
                            )
                            await self._download_in_chunks(url, target_path, client, chunk_size)
                            return
                        else:
                            raise

                if attempt < max_attempts:
                    backoff = base_backoff * attempt
                    logger.info(f"Retrying in {backoff}s", extra={"attempt": attempt, "backoff": backoff})
                    await asyncio.sleep(backoff)

            raise RuntimeError(f"Failed to download after {max_attempts} attempts: {url}")

    async def _download_in_chunks(
        self,
        url: str,
        target_path: str,
        client: httpx.AsyncClient,
        chunk_size: int = 15 * 1024,
    ) -> None:
        """
        Fallback: download the file in fixed-size chunks using Range requests.
        Assumes server supports Accept-Ranges: bytes.
        Includes delay and retry logic to handle rate limits and transient failures.
        """
        etag = None
        total_size = None
        try:
            head_response = await client.head(url)
            head_response.raise_for_status()
            etag = head_response.headers.get("etag")
            content_length = head_response.headers.get("content-length")
            if content_length:
                total_size = int(content_length)
        except httpx.HTTPError:
            pass

        if total_size is None:
            resp = await client.get(url, headers={"Range": "bytes=0-0"})
            resp.raise_for_status()
            if resp.status_code == 206:
                content_range = resp.headers.get("content-range", "")
                if "/" in content_range:
                    total_size = int(content_range.split("/")[-1])
                if not etag:
                    etag = resp.headers.get("etag")
            else:
                content_length = resp.headers.get("content-length")
                if content_length:
                    total_size = int(content_length)

        if total_size is None or total_size == 0:
            raise RuntimeError("Unable to determine total file size for chunked download")

        logger.info(
            "Chunked download starting",
            extra={"url": url, "total_size": total_size, "chunk_size": chunk_size, "etag": etag},
        )

        # Create/empty the target file
        with open(target_path, "wb"):
            pass

        start = 0
        first_chunk = True
        while start < total_size:
            end = min(start + chunk_size - 1, total_size - 1)
            requested_bytes = end - start + 1
            headers = {"Range": f"bytes={start}-{end}"}
            # Include If-Range with ETag after the first successful chunk
            if etag and not first_chunk:
                headers["If-Range"] = etag

            for attempt in range(1, 4):
                try:
                    logger.debug(f"Downloading chunk {start}-{end} ({requested_bytes} bytes)", extra={"attempt": attempt})
                    async with client.stream("GET", url, headers=headers) as resp:
                        resp.raise_for_status()

                        chunk_bytes_received = 0
                        # The server should return 206 for ranged requests
                        if resp.status_code == 206:
                            # capture/refresh ETag if server returns one
                            resp_etag = resp.headers.get("etag")
                            if resp_etag:
                                etag = resp_etag
                            with open(target_path, "ab") as f:
                                async for chunk in resp.aiter_bytes():
                                    f.write(chunk)
                                    chunk_bytes_received += len(chunk)
                        elif resp.status_code == 200:
                            # If server returned the whole file for this request,
                            # accept it only if this is the first chunk covering the whole file
                            if start == 0 and end >= total_size - 1:
                                with open(target_path, "wb") as f:
                                    async for chunk in resp.aiter_bytes():
                                        f.write(chunk)
                                        chunk_bytes_received += len(chunk)
                            else:
                                raise RuntimeError(f"Unexpected 200 OK for chunk {start}-{end}")
                        else:
                            raise RuntimeError(f"Unexpected status {resp.status_code} for chunk {start}-{end}")

                        if chunk_bytes_received < requested_bytes and start + chunk_bytes_received < total_size:
                             logger.warning(f"Chunk truncated: received {chunk_bytes_received}/{requested_bytes}")
                             # Update 'start' based on what we actually got so the next iteration continues correctly
                             start += chunk_bytes_received
                             break # move to next chunk iteration with updated start

                        start = end + 1
                        break # break attempt loop
                except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.HTTPError) as exc:
                    if attempt == 3:
                        raise
                    backoff = 2 ** attempt
                    logger.warning(
                        f"Chunk download failed, retrying in {backoff}s",
                        extra={"attempt": attempt, "error": str(exc)}
                    )
                    await asyncio.sleep(backoff)

            await asyncio.sleep(0.5)
            first_chunk = False

        logger.info("Chunked download completed", extra={"url": url, "total_size": total_size})

    async def execute(self, job: dict):
        call_id = job.get('call_id')
        # Support both key names: 'audio_url' (sipuni-listener) and 'call_link' (sheets-sync legacy)
        audio_url = job.get('audio_url') or job.get('call_link')

        if not audio_url:
            raise ValueError(f"Missing audio URL for call_id={call_id}: job has no 'audio_url' or 'call_link' field")

        logger.info(
            "processing audio job",
            extra={"call_id": call_id,
                   "audio_url": audio_url, "stt_provider": self.stt_provider_name},
        )

        tmp_path = None
        wav_path = None
        t_total = time.monotonic()
        try:
            # 1. Download audio
            logger.info("[1/6] downloading audio", extra={"call_id": call_id, "audio_url": audio_url})

            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                tmp_path = tmp.name

            if audio_url.startswith("minio://"):
                # Handle MinIO protocol
                parts = audio_url.replace("minio://", "").split("/")
                if len(parts) < 2:
                    raise ValueError(f"Invalid minio URL: {audio_url}")
                # bucket = parts[0] # MinioClient uses its own bucket or we can extend it
                object_name = "/".join(parts[1:])
                self.minio.download_file(object_name, tmp_path)
            else:
                # Handle HTTP(S) protocol with resume and cookie persistence
                await self._download_with_resume(
                    url=audio_url,
                    target_path=tmp_path,
                    max_attempts=2,
                    base_backoff=5,
                    chunk_size=15 * 1024,
                    split_fallback=True,
                )

            file_size_kb = round(os.path.getsize(tmp_path) / 1024, 1)
            logger.info("[1/6] audio downloaded", extra={"call_id": call_id, "file_size_kb": file_size_kb, "tmp_path": tmp_path})

            # 2. Convert to 16kHz WAV
            logger.info("[2/6] converting to 16kHz WAV", extra={"call_id": call_id})
            duration_s = AudioConverter.get_duration_seconds(tmp_path)
            wav_path = AudioConverter.to_stt_wav(tmp_path)
            wav_size_kb = round(os.path.getsize(wav_path) / 1024, 1)
            logger.info("[2/6] WAV conversion done",
                        extra={"call_id": call_id, "duration_s": duration_s,
                               "wav_size_kb": wav_size_kb, "wav_path": wav_path})

            # 3. Archive to MinIO
            logger.info("[3/6] uploading to MinIO", extra={"call_id": call_id, "object_name": f"{call_id}.wav"})
            object_name = f"{call_id}.wav"
            self.minio.upload_file(object_name, wav_path)
            logger.info("[3/6] MinIO upload done", extra={"call_id": call_id, "object_name": object_name})

            # Update call record with MinIO reference
            update_call_link(call_id, f"minio://audio/{object_name}")

            # 4. Transcribe (using API provider)
            # Old local STT logic commented out:
            # async with httpx.AsyncClient() as client:
            #     # Note: stt-local expected 'url' in form data.
            #     # Since we archived it, we can still use the original url or the new minio url if stt-local supports it.
            #     # PRD says stt-local uses the URL.
            #     resp = await client.post(f"{self.stt_local_url}/transcribe", data={"url": audio_url}, timeout=300)
            #     resp.raise_for_status()
            #     transcript_data = resp.json()

            # New API logic:
            # Send the original compressed MP3 to the STT API — WAV is uncompressed
            # and can exceed provider size limits (e.g. Groq 25 MB free tier).
            # All API providers (OpenAI, Groq, Gemini) handle MP3 natively and
            # do their own 16 kHz downsampling server-side.
            logger.info("[4/6] sending to STT provider",
                        extra={"call_id": call_id, "stt_provider": self.stt_provider_name,
                               "file_size_kb": file_size_kb})

            integrations = await self.api_client.get_active_integrations()
            stt_provider = self._get_stt_provider(integrations)

            t_stt = time.monotonic()
            transcript_data = await stt_provider.transcribe(tmp_path)
            stt_elapsed = round(time.monotonic() - t_stt, 2)
            stt_text = transcript_data.get("text", "")
            stt_segments = transcript_data.get("segments", [])
            logger.info("[4/6] STT transcription received",
                        extra={"call_id": call_id, "stt_provider": self.stt_provider_name,
                               "elapsed_s": stt_elapsed, "segment_count": len(stt_segments),
                               "text_length": len(stt_text),
                               "text_preview": stt_text[:200] if stt_text else ""})

            # 5. Diarization (still uses the 16 kHz WAV for local processing)
            logger.info("[5/6] running diarization", extra={"call_id": call_id, "wav_path": wav_path})
            diarization_segments = self.diarization_service.process(wav_path)
            logger.info("[5/6] diarization done",
                        extra={"call_id": call_id,
                               "diarization_segments": len(diarization_segments) if diarization_segments else 0})

            # 6. Transform and Merge
            logger.info("[6/6] merging transcript with diarization", extra={"call_id": call_id})
            transcript_segments = []
            for seg in transcript_data.get("segments", []):
                transcript_segments.append({
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "text": seg.get("text")
                })

            segments = merge_transcript_with_diarization(transcript_segments, diarization_segments)

            final_transcript = {
                "call_id": call_id,
                "segments": segments,
                "text": transcript_data.get("text", "")
            }

            # Save to DB
            # We wrap the segments in the expected JSON column structure
            save_transcript(call_id, segments, self.stt_provider_name)

            # Publish event
            await publish_transcript_ready(call_id)

            total_elapsed = round(time.monotonic() - t_total, 2)
            logger.info(
                "[6/6] audio job completed successfully",
                extra={
                    "call_id": call_id,
                    "stt_provider": self.stt_provider_name,
                    "duration_s": duration_s,
                    "segment_count": len(segments),
                    "text_length": len(stt_text),
                    "total_elapsed_s": total_elapsed,
                    "published_stream": "transcript_ready",
                },
            )
        except Exception as e:
            # capture full traceback so higher-level consumers/logs see the real error
            import traceback
            tb = traceback.format_exc()
            # logger.exception will write the traceback to logs; include tb in extra so structured logs show it
            logger.exception("audio job failed", extra={"call_id": call_id, "error": tb[:2000]})
            raise
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
