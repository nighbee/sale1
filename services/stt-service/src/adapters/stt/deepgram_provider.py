import os
import logging
from typing import Optional
from deepgram import DeepgramClient, PrerecordedOptions
from src.core.ports.stt_provider import STTProvider

logger = logging.getLogger(__name__)

class DeepgramSTTProvider(STTProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            logger.warning("DEEPGRAM_API_KEY is not set")
        self.client = DeepgramClient(self.api_key)
        self.model = model or os.getenv("DEEPGRAM_MODEL", "nova-2")

    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        if not self.api_key:
            raise RuntimeError("Deepgram API key missing")

        try:
            logger.info(f"Transcribing with Deepgram: {audio_path}", extra={"language": language})

            with open(audio_path, "rb") as f:
                buffer = f.read()

            options_kwargs = {
                "model": self.model,
                "smart_format": True,
                "punctuate": True,
                "utterances": True,
            }
            if language:
                options_kwargs["language"] = language
            else:
                options_kwargs["language"] = "ru" # Defaulting to RU as it was before

            options = PrerecordedOptions(**options_kwargs)

            response = await self.client.listen.asyncprerecorded.v("1").transcribe_file(
                {"buffer": buffer}, options
            )

            res_dict = {}
            if hasattr(response, "to_dict"):
                res_dict = response.to_dict()
            elif hasattr(response, "results"):
                res_obj = getattr(response, "results", None)
                if hasattr(res_obj, "to_dict"):
                    res_dict = {"results": res_obj.to_dict()}
                else:
                    res_dict = {"results": res_obj}

            results = res_dict.get("results", {})
            channels = results.get("channels", [])

            if not channels:
                logger.warning("Deepgram returned no channels", extra={"audio_path": audio_path})
                return {"text": "", "segments": []}

            alternatives = channels[0].get("alternatives", [])
            if not alternatives:
                logger.warning("Deepgram returned no alternatives", extra={"audio_path": audio_path})
                return {"text": "", "segments": []}

            channel = alternatives[0]
            full_text = channel.get("transcript", "")

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
                },
            )
            return {"text": full_text, "segments": segments}

        except Exception as e:
            logger.error("Deepgram STT failed", extra={"error": str(e), "audio_path": audio_path})
            raise RuntimeError(f"Deepgram STT failed: {str(e)}") from e

    async def get_models(self) -> list:
        try:
            # Deepgram SDK doesn't have a simple list_models, usually you just know them
            # or use the API to fetch them. For now, let's return common ones.
            return [
                "nova-3",
                "nova-2",
                "flux-general-en",
                "nova-2-phonecall",
                "nova-2-video",
                "nova-2-medical",
                "nova-2-meeting"
            ]
        except Exception as e:
            logger.error(f"Failed to fetch Deepgram models: {e}")
            return ["nova-3", "nova-2"]
