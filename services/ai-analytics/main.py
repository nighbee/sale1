import asyncio
import logging
import threading
from fastapi import FastAPI
from pydantic import BaseModel, Field
from src.adapters.events.redis_consumer import start_consumer
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Analytics Service",
    description="LLM-based call analysis and KPI computation service for SalesAI",
    version="1.0.0"
)

@app.get("/health", tags=["General"])
async def health():
    return {"status": "healthy", "service": "ai-analytics"}

class AnalyzeRequest(BaseModel):
    company_id: str = Field(..., example="550e8400-e29b-41d4-a716-446655440000")

@app.post("/analyze/{call_id}", tags=["Analysis"])
async def trigger_analysis(call_id: str, req: AnalyzeRequest):
    """
    Manually trigger call analysis.
    """
    use_case = AnalyzeCallUseCase()
    await use_case.execute(call_id, req.company_id)
    return {"message": f"Analysis triggered for call {call_id}"}

def run_consumer():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(start_consumer())

if __name__ == "__main__":
    logger.info("Starting AI Analytics Service...")

    # Start consumer in a background thread
    consumer_thread = threading.Thread(target=run_consumer, daemon=True)
    consumer_thread.start()

    # Start FastAPI
    uvicorn.run(app, host="0.0.0.0", port=5002)
