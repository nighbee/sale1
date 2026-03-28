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

            # In Deepgram SDK v3, response is typically an object.
            # We use to_dict() for easier and safer field access if available,
            # otherwise we fall back to attribute access.
            res_dict = {}
            if hasattr(response, "to_dict"):
                res_dict = response.to_dict()
            elif hasattr(response, "results"):
                # Manual conversion of the results part if it's an object
                res_obj = getattr(response, "results", None)
                if hasattr(res_obj, "to_dict"):
                    res_dict = {"results": res_obj.to_dict()}
                else:
                    # Last resort fallback - though SDK v3 PrerecordedResponse has to_dict()
                    res_dict = {"results": res_obj}

            results = res_dict.get("results", {})
            channels = results.get("channels", [])

            if not channels:
                logger.warning("Deepgram returned no channels", extra={"response": str(res_dict)[:1000]})
                return {"text": "", "segments": []}

            alternatives = channels[0].get("alternatives", [])
            if not alternatives:
                logger.warning("Deepgram returned no alternatives", extra={"response": str(res_dict)[:1000]})
                return {"text": "", "segments": []}

            channel = alternatives[0]
            full_text = channel.get("transcript", "")

            # Map utterances → segments (start / end / text)
            segments = []
            utterances = results.get("utterances", [])
            if utterances:
                for utt in utterances:
                    segments.append({
                        "start": utt.get("start", 0),
                        "end": utt.get("end", 0),
                        "text": utt.get("transcript", ""),
                    })
            else:
                # Fallback: use word-level timestamps grouped into one segment
                words = channel.get("words", [])
                if words:
                    segments.append({
                        "start": words[0].get("start", 0),
                        "end": words[-1].get("end", 0),
                        "text": full_text,
                    })

            logger.info(
                "Deepgram transcription complete",
                extra={
                    "audio_path": audio_path,
                    "segments": len(segments),
                    "chars": len(full_text),
                    "has_utterances": len(utterances) > 0
                },
            )
            return {"text": full_text, "segments": segments}

        except Exception as e:
            raise Exception(f"Deepgram STT failed: {str(e)}")
