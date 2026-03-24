import logging
import sys
from pythonjsonlogger import jsonlogger


class ServiceFilter(logging.Filter):
    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def filter(self, record: logging.LogRecord) -> bool:
        record.service = self.service_name
        return True


def setup_logging(service_name: str = "sheets-sync", level: str = "info"):
    log_level = getattr(logging, level.upper(), logging.INFO)
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
    root.handlers = []
    root.addHandler(handler)
    root.setLevel(log_level)
    logging.getLogger(service_name).info(
        "Logging initialised", extra={"service": service_name, "level": level}
    )
