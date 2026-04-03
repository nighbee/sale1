from abc import ABC, abstractmethod
from typing import Optional

class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str, audio_url: Optional[str] = None, language: Optional[str] = None) -> dict:
        """
        Transcribe audio file.
        
        Args:
            audio_path (str): Path to the local audio file.
            audio_url (str, optional): Remote URL to the audio file if provider supports direct URL transcription.
            language (str, optional): Language code for transcription (e.g., 'en', 'ru').
            
        Returns:
            dict: Transcription result containing 'text' and 'segments'.
        """
        pass
