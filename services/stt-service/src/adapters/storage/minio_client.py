import os
import time
from minio import Minio
import logging

logger = logging.getLogger(__name__)

class MinioClient:
    def __init__(self):
        endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
        access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        secure = os.getenv("MINIO_SECURE", "False").lower() == "true"

        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
        self.bucket_name = "audio"
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self, retries: int = 10, delay: float = 3.0):
        """Wait for MinIO to be ready, then ensure the bucket exists."""
        for attempt in range(1, retries + 1):
            try:
                if not self.client.bucket_exists(self.bucket_name):
                    self.client.make_bucket(self.bucket_name)
                    logger.info(f"Created MinIO bucket '{self.bucket_name}'")
                else:
                    logger.info(f"MinIO bucket '{self.bucket_name}' already exists")
                return
            except Exception as e:
                if attempt == retries:
                    logger.error(f"MinIO not reachable after {retries} attempts: {e}")
                    raise
                logger.warning(
                    f"MinIO not ready (attempt {attempt}/{retries}), retrying in {delay}s: {e}"
                )
                time.sleep(delay)

    def upload_file(self, object_name, file_path):
        try:
            self.client.fput_object(self.bucket_name, object_name, file_path)
            logger.info(f"Uploaded {file_path} to MinIO as {object_name}")
            return object_name
        except Exception as e:
            logger.error(f"Failed to upload to MinIO: {e}")
            raise

    def download_file(self, object_name, file_path):
        try:
            self.client.fget_object(self.bucket_name, object_name, file_path)
            logger.info(f"Downloaded {object_name} from MinIO to {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Failed to download from MinIO: {e}")
            raise
