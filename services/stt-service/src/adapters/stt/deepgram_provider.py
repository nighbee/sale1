import os
import logging
from deepgram import DeepgramClient, PrerecordedOptions
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)


class DeepgramSTTProvider(STTProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not set")
        self.client = DeepgramClient(self.api_key)
        self.model = os.getenv("DEEPGRAM_MODEL", "nova-2")

    async def transcribe(self, audio_path: str) -> dict:
        try:
            with open(audio_path, "rb") as f:
                buffer = f.read()

            options = PrerecordedOptions(
                model=self.model,
                smart_format=True,
                punctuate=True,
                utterances=True,   # gives us start/end/text per utterance → segments
                language="ru",     # primary language; Deepgram auto-detects if wrong
            )

            response = await self.client.listen.asyncprerecorded.v("1").transcribe_file(
                {"buffer": buffer}, options
            )

            result = response.results
            channel = result.channels[0].alternatives[0]
            full_text = channel.transcript

            # Map utterances → segments (start / end / text)
            segments = []
            if result.utterances:
                for utt in result.utterances:
                    segments.append({
                        "start": utt.start,
                        "end": utt.end,
                        "text": utt.transcript,
                    })
            else:
                # Fallback: use word-level timestamps grouped into one segment
                words = channel.words or []
                if words:
                    segments.append({
                        "start": words[0].start,
                        "end": words[-1].end,
                        "text": full_text,
                    })

            logger.info(
                "Deepgram transcription complete",
                extra={"audio_path": audio_path, "segments": len(segments),
                       "chars": len(full_text)},
            )
            return {"text": full_text, "segments": segments}

        except Exception as e:
            raise Exception(f"Deepgram STT failed: {str(e)}")
