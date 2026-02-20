import logging
import sys
from pythonjsonlogger import jsonlogger


def setup_logging(service_name: str = "sheets-sync", level: str = "info"):
    log_level = getattr(logging, level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers = []
    root.addHandler(handler)
    root.setLevel(log_level)
    logging.getLogger(service_name).info(
        "Logging initialised", extra={"service": service_name, "level": level}
    )
