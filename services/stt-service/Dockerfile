FROM python:3.11-slim
WORKDIR /app
ENV PYTHONPATH=/app

# Copy static ffmpeg/ffprobe binaries — avoids pulling ~96 apt dependencies
COPY --from=mwader/static-ffmpeg:latest /ffmpeg /usr/local/bin/ffmpeg
COPY --from=mwader/static-ffmpeg:latest /ffprobe /usr/local/bin/ffprobe
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
