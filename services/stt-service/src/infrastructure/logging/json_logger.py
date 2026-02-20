import logging
import os
import sys

from pythonjsonlogger import jsonlogger


class ServiceFilter(logging.Filter):
    """Injects the service name into every log record."""

    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def filter(self, record: logging.LogRecord) -> bool:
        record.service = self.service_name
        return True


def setup_logging(service_name: str) -> None:
    """Configure JSON structured logging for the whole process.

    All loggers obtained via ``logging.getLogger()`` will emit JSON to stdout
    after this function is called once at startup.

    The log level is controlled by the ``LOG_LEVEL`` environment variable
    (default: ``INFO``).
    """
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(service)s %(message)s",
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "logger",
        },
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)
    handler.addFilter(ServiceFilter(service_name))

    root = logging.getLogger()
    # Remove any handlers that basicConfig may have already added
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(log_level)
