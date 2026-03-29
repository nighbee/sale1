from abc import ABC, abstractmethod

class AudioDownloader(ABC):
    @abstractmethod
    async def download(self, url: str, target_path: str) -> None:
        """
        Download an audio file from the given URL and save it to the target path.
        """
        pass
