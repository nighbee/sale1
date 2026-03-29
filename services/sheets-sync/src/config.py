import os
import json
import logging

logger = logging.getLogger(__name__)


class Config:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "host=postgres port=5432 user=salesai_user password=strong_password dbname=salesai sslmode=disable",
    )
    @staticmethod
    def get_redis_url() -> str:
        url = os.getenv("REDIS_URL")
        if url:
            return url
        password = os.getenv("REDIS_PASSWORD")
        host = os.getenv("REDIS_HOST", "redis")
        port = os.getenv("REDIS_PORT", "6379")
        if password:
            return f"redis://:{password}@{host}:{port}"
        return f"redis://{host}:{port}"

    # Google Sheets
    GOOGLE_SHEETS_ID: str = os.getenv("GOOGLE_SHEETS_ID", "")
    SHEET_NAME: str = os.getenv("SHEET_NAME", "Sheet1")

    # Auth: inline JSON takes priority over file path
    GOOGLE_SERVICE_ACCOUNT_JSON: str = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    GOOGLE_SERVICE_ACCOUNT_JSON_FILE: str = os.getenv(
        "GOOGLE_SERVICE_ACCOUNT_JSON_FILE", ""
    )

    # Sync
    SYNC_INTERVAL: str = os.getenv("SYNC_INTERVAL", "5m")
    # Optional: force a specific company UUID; if blank, resolved from DB
    COMPANY_ID: str = os.getenv("COMPANY_ID", "")

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")

    # Queue name consumed by stt-service
    QUEUE_NAME: str = "bullmq:audio_processing"

    # Team creation
    TEAM_NAME: str = os.getenv("TEAM_NAME", "callteam1")
    MAIN_API_URL: str = os.getenv("MAIN_API_URL", "http://main-api:8000")

    @classmethod
    def service_account_info(cls) -> dict:
        """Return parsed service account credentials dict."""
        raw = cls.GOOGLE_SERVICE_ACCOUNT_JSON.strip()
        if raw:
            return json.loads(raw)
        path = cls.GOOGLE_SERVICE_ACCOUNT_JSON_FILE.strip()
        if path:
            with open(path) as f:
                return json.load(f)
        raise ValueError(
            "Neither GOOGLE_SERVICE_ACCOUNT_JSON nor GOOGLE_SERVICE_ACCOUNT_JSON_FILE is set"
        )

    @classmethod
    def sync_interval_seconds(cls) -> int:
        raw = cls.SYNC_INTERVAL.strip()
        if raw.endswith("s"):
            return int(raw[:-1])
        if raw.endswith("m"):
            return int(raw[:-1]) * 60
        if raw.endswith("h"):
            return int(raw[:-1]) * 3600
        return int(raw)
