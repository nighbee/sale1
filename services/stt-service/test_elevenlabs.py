import asyncio
import logging
import os
from src.adapters.stt.elevenlabs_provider import ElevenLabsSTTProvider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_elevenlabs_stt():
    # You need a valid audio file path here for a real test
    audio_path = "test_audio.mp3" 
    
    if not os.path.exists(audio_path):
        logger.error(f"Audio file not found: {audio_path}")
        return

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        logger.error("ELEVENLABS_API_KEY not found in environment")
        return

    provider = ElevenLabsSTTProvider(api_key=api_key)
    
    try:
        logger.info("Starting transcription test...")
        result = await provider.transcribe(audio_path)
        
        logger.info(f"Transcription successful!")
        logger.info(f"Text: {result['text'][:100]}...")
        logger.info(f"Segments: {len(result['segments'])}")
        logger.info(f"Is Diarized: {result['is_diarized']}")
        
        for i, seg in enumerate(result['segments'][:5]):
            logger.info(f"Segment {i}: [{seg['start']}-{seg['end']}] {seg['speaker']}: {seg['text']}")
            
    except Exception as e:
        logger.error(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_elevenlabs_stt())
