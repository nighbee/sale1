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

    @abstractmethod
    async def get_models(self, category: Optional[str] = None) -> list:
        """
        Get list of available models for the provider.

        Args:
            category (str, optional): Category of models to fetch (e.g., 'stt', 'llm').

        Returns:
            list: List of model identifiers.
        """
        pass

    def supports_url_transcription(self, url: str) -> bool:
        """
        Check if the provider supports direct transcription from the given URL.

        Args:
            url (str): Remote URL to the audio file.

        Returns:
            bool: True if provider can transcribe directly from this URL.
        """
        return False
