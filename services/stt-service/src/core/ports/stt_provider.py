from abc import ABC, abstractmethod

class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe audio file.
        
        Args:
            audio_path (str): Path to the audio file.
            
        Returns:
            dict: Transcription result containing 'text' and 'segments'.
        """
        pass
