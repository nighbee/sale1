FROM python:3.11-slim
WORKDIR /app
ENV PYTHONPATH=/app

# Copy static ffmpeg/ffprobe binaries — avoids pulling ~96 apt dependencies
COPY --from=mwader/static-ffmpeg:latest /ffmpeg /usr/local/bin/ffmpeg
COPY --from=mwader/static-ffmpeg:latest /ffprobe /usr/local/bin/ffprobe

# Install curl for robust audio downloads (Sipuni)
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
