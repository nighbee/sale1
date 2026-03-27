import os
import sys
import logging
from unittest.mock import MagicMock

# Mock dependencies that might be hard to initialize in a simple smoke test
sys.modules['src.infrastructure.monitoring.metrics'] = MagicMock()

# Mock DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db"

from src.adapters.storage.postgres_repo import get_pool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_connection_pool():
    logger.info("Testing ThreadedConnectionPool initialization (mocked)...")
    import psycopg2
    from psycopg2 import pool

    # Mock psycopg2.connect to avoid actual DB connection
    psycopg2.connect = MagicMock()

    p = get_pool()
    from psycopg2.pool import ThreadedConnectionPool
    assert isinstance(p, ThreadedConnectionPool), f"Expected ThreadedConnectionPool, got {type(p)}"
    logger.info("Successfully initialized ThreadedConnectionPool.")

    # We won't actually connect to a real DB here unless it's available,
    # but we've verified the pool type and basic initialization logic.
    # psycopg2.pool.AbstractConnectionPool has private attributes or different ways to access these.
    # Simple check if p is initialized correctly.
    logger.info("Pool initialization verified.")

if __name__ == "__main__":
    try:
        test_connection_pool()
        print("Smoke test PASSED")
    except Exception as e:
        print(f"Smoke test FAILED: {e}")
        sys.exit(1)
