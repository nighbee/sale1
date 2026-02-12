import asyncio
import logging
import threading
from fastapi import FastAPI
from pydantic import BaseModel, Field
from src.adapters.queue.bullmq_consumer import start_consumer
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="STT Service",
    description="Speech-to-Text processing service for SalesAI",
    version="1.0.0"
)

@app.get("/health", tags=["General"])
async def health():
    return {"status": "healthy", "service": "stt-service"}

class ProcessRequest(BaseModel):
    call_id: str = Field(..., example="880e8400-e29b-41d4-a716-446655440002")
    company_id: str = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    audio_url: str = Field(..., example="https://files.sipuni.com/test/call.mp3")

@app.post("/process", tags=["STT"])
async def process_audio(req: ProcessRequest):
    """
    Manually trigger audio processing.
    """
    from src.core.usecases.process_audio import ProcessAudioUseCase
    use_case = ProcessAudioUseCase()
    await use_case.execute({
        "call_id": req.call_id,
        "company_id": req.company_id,
        "audio_url": req.audio_url
    })
    return {"message": f"Processing triggered for call {req.call_id}"}

def run_consumer():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(start_consumer())

if __name__ == "__main__":
    logger.info("Starting STT Service...")

    # Start consumer in a background thread
    consumer_thread = threading.Thread(target=run_consumer, daemon=True)
    consumer_thread.start()

    # Start FastAPI
    uvicorn.run(app, host="0.0.0.0", port=5001)
