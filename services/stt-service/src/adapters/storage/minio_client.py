import os
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

    def _ensure_bucket_exists(self):
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def upload_file(self, object_name, file_path):
        try:
            self.client.fput_object(self.bucket_name, object_name, file_path)
            logger.info(f"Uploaded {file_path} to MinIO as {object_name}")
            return object_name
        except Exception as e:
            logger.error(f"Failed to upload to MinIO: {e}")
            raise
