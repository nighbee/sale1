FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .

# Use PyPI mirror and upgrade pip to avoid network issues
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -i https://pypi.org/simple/ -r requirements.txt

COPY . .
CMD ["python", "main.py"]
