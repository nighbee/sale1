import os
import logging
from pydub import AudioSegment

logger = logging.getLogger(__name__)

class AudioConverter:
    """
    Handles audio conversion and normalization using pydub (FFmpeg).
    Ensures consistent audio format (16kHz WAV Mono) for STT and Diarization.
    """

    @staticmethod
    def to_stt_wav(input_path: str) -> str:
        """
        Converts any audio file to a 16kHz mono WAV file suitable for transcription and diarization.
        Returns the path to the newly created WAV file.
        """
        try:
            # Determine output path (e.g., input.mp3 -> input_16k.wav)
            base_path, _ = os.path.splitext(input_path)
            output_path = f"{base_path}_16k.wav"

            logger.info(f"converting {input_path} to 16kHz WAV mono at {output_path}")

            # Load and convert
            audio = AudioSegment.from_file(input_path)
            audio = audio.set_frame_rate(16000).set_channels(1)
            audio.export(output_path, format="wav")

            return output_path
        except Exception as e:
            logger.error(f"failed to convert audio: {str(e)}")
            raise

    @staticmethod
    def get_duration_seconds(file_path: str) -> float:
        """ Returns the duration of an audio file in seconds. """
        try:
            audio = AudioSegment.from_file(file_path)
            return round(len(audio) / 1000, 2)
        except Exception as e:
            logger.error(f"failed to get audio duration: {str(e)}")
            return 0.0
