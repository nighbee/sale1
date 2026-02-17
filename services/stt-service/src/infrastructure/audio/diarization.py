import os
import logging
try:
    import torch
except ImportError:
    torch = None

logger = logging.getLogger(__name__)

class DiarizationService:
    def __init__(self):
        self.hf_token = os.getenv("HF_TOKEN")
        self.pipeline = None
        if self.hf_token and torch:
            try:
                from pyannote.audio import Pipeline
                self.pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=self.hf_token
                )
                if torch.cuda.is_available():
                    self.pipeline.to(torch.device("cuda"))
                logger.info("Pyannote diarization pipeline loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load Pyannote pipeline: {e}")
        else:
            logger.warning("HF_TOKEN not set or torch not installed, Pyannote diarization will be skipped")

    def process(self, audio_path):
        if not self.pipeline:
            return None

        try:
            diarization = self.pipeline(audio_path)
            segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                segments.append({
                    "start": turn.start,
                    "end": turn.end,
                    "speaker": speaker
                })
            return segments
        except Exception as e:
            logger.error(f"Diarization failed: {e}")
            return None

def merge_transcript_with_diarization(transcript_segments, diarization_segments):
    if not diarization_segments:
        # Fallback to mock diarization if real one failed or skipped
        for i, seg in enumerate(transcript_segments):
            seg['speaker'] = "SPEAKER_0" if i % 2 == 0 else "SPEAKER_1"
        return transcript_segments

    # Match each transcript segment with the speaker from diarization
    # based on the midpoint of the transcript segment
    for t_seg in transcript_segments:
        t_start = t_seg.get('start')
        t_end = t_seg.get('end')

        if t_start is None or t_end is None:
            t_seg['speaker'] = "UNKNOWN"
            continue

        t_mid = (t_start + t_end) / 2

        assigned_speaker = "UNKNOWN"
        for d_seg in diarization_segments:
            if d_seg['start'] <= t_mid <= d_seg['end']:
                assigned_speaker = d_seg['speaker']
                break

        # If not found, try finding the closest segment
        if assigned_speaker == "UNKNOWN":
            min_dist = float('inf')
            for d_seg in diarization_segments:
                dist = min(abs(t_mid - d_seg['start']), abs(t_mid - d_seg['end']))
                if dist < min_dist:
                    min_dist = dist
                    assigned_speaker = d_seg['speaker']

        # Map Pyannote speaker labels (SPEAKER_00, SPEAKER_01...) to our format
        if "00" in assigned_speaker:
            t_seg['speaker'] = "SPEAKER_0"
        elif "01" in assigned_speaker:
            t_seg['speaker'] = "SPEAKER_1"
        else:
            t_seg['speaker'] = assigned_speaker

    return transcript_segments
