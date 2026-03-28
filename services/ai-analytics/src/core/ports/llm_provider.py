from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def analyze(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        """
        Analyze the given prompt using an LLM.

        Args:
            system_prompt (str): The system prompt defining the persona and rules.
            user_prompt (str): The user prompt containing the transcript and script.
            model (str, optional): The model name to use.

        Returns:
            dict: The analysis result in JSON format.
        """
        pass
