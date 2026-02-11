import os
import io
import logging
import requests
import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
# accelerate is used implicitly via device_map="auto" in transformers

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


app = FastAPI()

model = None
processor = None
asr_pipe = None
device_strategy = None

def get_gpu_info():
    """Get GPU availability and memory information.
    Returns: (gpu_count, gpu_name, gpu_memory_gb, gpu_memory_free_gb) or None if no GPU"""
    if not torch.cuda.is_available():
        return None
    
    gpu_count = torch.cuda.device_count()
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    gpu_memory_free_gb = (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)) / (1024**3)
    
    return (gpu_count, gpu_name, gpu_memory_gb, gpu_memory_free_gb)

def get_pipe():
    global model, processor, asr_pipe, device_strategy
    if asr_pipe is not None:
        return asr_pipe

    logging.info("Initializing ASR pipeline...")
    model_id = os.getenv("MODEL_ID", "openai/whisper-large-v3")
    
    # Check GPU availability
    gpu_info = get_gpu_info()
    use_gpu = gpu_info is not None
    
    if use_gpu:
        gpu_count, gpu_name, gpu_memory_gb, gpu_memory_free_gb = gpu_info
        logging.info(f"GPU detected: {gpu_name}")
        logging.info(f"GPU memory: {gpu_memory_gb:.2f} GB total, {gpu_memory_free_gb:.2f} GB free")
        
        # Estimate model memory requirements (Whisper Large V3 ~3GB in FP16)
        model_size_gb = 3.0  # Approximate size for whisper-large-v3 in FP16
        use_hybrid = gpu_memory_free_gb < model_size_gb * 1.2  # Need 20% buffer
        
        if use_hybrid:
            logging.info(f"GPU memory insufficient ({gpu_memory_free_gb:.2f} GB free < {model_size_gb * 1.2:.2f} GB needed)")
            logging.info("Using hybrid GPU+CPU strategy with device_map='auto'")
            device_strategy = "hybrid"
            
            # Use device_map='auto' to automatically split model between GPU and CPU
            try:
                model_local = AutoModelForSpeechSeq2Seq.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16,
                    low_cpu_mem_usage=True,
                    use_safetensors=True,
                    device_map="auto",  # Automatically splits between GPU and CPU
                )
                processor_local = AutoProcessor.from_pretrained(model_id)
                
                # Create pipeline with device_map
                asr_pipe_local = pipeline(
                    task="automatic-speech-recognition",
                    model=model_local,
                    tokenizer=processor_local.tokenizer,
                    feature_extractor=processor_local.feature_extractor,
                    torch_dtype=torch.float16,
                )
                
                logging.info("Model loaded with hybrid GPU+CPU distribution")
            except Exception as e:
                logging.warning(f"Failed to load with device_map='auto': {e}")
                logging.info("Falling back to CPU-only mode")
                device_strategy = "cpu"
                model_local = AutoModelForSpeechSeq2Seq.from_pretrained(
                    model_id,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True,
                    use_safetensors=True,
                )
                model_local.to("cpu")
                processor_local = AutoProcessor.from_pretrained(model_id)
                
                asr_pipe_local = pipeline(
                    task="automatic-speech-recognition",
                    model=model_local,
                    tokenizer=processor_local.tokenizer,
                    feature_extractor=processor_local.feature_extractor,
                    device="cpu",
                )
        else:
            logging.info(f"GPU memory sufficient ({gpu_memory_free_gb:.2f} GB free >= {model_size_gb * 1.2:.2f} GB needed)")
            logging.info("Using GPU-only strategy")
            device_strategy = "gpu"
            
            model_local = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id,
                torch_dtype=torch.float16,
                low_cpu_mem_usage=True,
                use_safetensors=True,
            )
            model_local.to("cuda:0")
            processor_local = AutoProcessor.from_pretrained(model_id)
            
            asr_pipe_local = pipeline(
                task="automatic-speech-recognition",
                model=model_local,
                tokenizer=processor_local.tokenizer,
                feature_extractor=processor_local.feature_extractor,
                torch_dtype=torch.float16,
                device="cuda:0",
            )
    else:
        logging.info("No GPU detected, using CPU-only strategy")
        device_strategy = "cpu"
        
        model_local = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
            use_safetensors=True,
        )
        model_local.to("cpu")
        processor_local = AutoProcessor.from_pretrained(model_id)
        
        asr_pipe_local = pipeline(
            task="automatic-speech-recognition",
            model=model_local,
            tokenizer=processor_local.tokenizer,
            feature_extractor=processor_local.feature_extractor,
            device="cpu",
        )

    model = model_local
    processor = processor_local
    asr_pipe = asr_pipe_local

    logging.info(f"ASR pipeline initialized successfully with {device_strategy.upper()} strategy.")
    return asr_pipe

def save_tmp(data: bytes, ext: str = ".mp3") -> str:
    tmp_dir = "/tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    path = os.path.join(tmp_dir, "input" + ext)
    with open(path, "wb") as f:
        f.write(data)
    return path

@app.get("/health")
async def health():
    """Health check endpoint with device information."""
    gpu_info = get_gpu_info()
    return {
        "status": "healthy",
        "device_strategy": device_strategy or "not_initialized",
        "gpu_available": gpu_info is not None,
        "gpu_info": {
            "name": gpu_info[1] if gpu_info else None,
            "memory_gb": round(gpu_info[2], 2) if gpu_info else None,
            "memory_free_gb": round(gpu_info[3], 2) if gpu_info else None,
        } if gpu_info else None,
    }

@app.post("/transcribe")
async def transcribe(url: str = Form(None), language: str = Form(None), file: UploadFile = File(None)):
    logging.info("Received /transcribe request.")
    pipe = get_pipe()

    if url:
        logging.info(f"Processing URL: {url}")
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
        except Exception as e:
            logging.error(f"Failed to download URL {url}: {e}")
            raise HTTPException(status_code=400, detail=f"cannot download url: {e}")
        tmp_path = save_tmp(resp.content, ".mp3")
    else:
        logging.info(f"Processing file: {file.filename if file else 'No file'}")
        if file is None:
            raise HTTPException(status_code=400, detail="either url or file is required")
        data = await file.read()
        _, ext = os.path.splitext(file.filename or "")
        if not ext:
            ext = ".mp3"
        tmp_path = save_tmp(data, ext)

    logging.info(f"File saved to temporary path: {tmp_path}")

    generate_kwargs = {"task": "transcribe"}
    if language:
        logging.info(f"Language specified: {language}")
        generate_kwargs["language"] = language

    logging.info("Starting transcription...")
    result = pipe(
        tmp_path,
        return_timestamps=True,
        generate_kwargs=generate_kwargs,
    )
    logging.info(f"Transcription finished. Text length: {len(result.get('text', ''))}")

    chunks = []
    for ch in result.get("chunks", []):
        ts = ch.get("timestamp") or [None, None]
        chunks.append(
            {
                "start": ts[0],
                "end": ts[1],
                "text": ch.get("text"),
            }
        )

    return {
        "text": result.get("text", ""),
        "segments": chunks,
        "language": language,
    }
