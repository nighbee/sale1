import os
import redis.asyncio as redis
import logging
import time

logger = logging.getLogger(__name__)

class CircuitBreaker:
    def __init__(self, service_name="stt_workflow"):
        self.service_name = service_name
        self.redis_url = os.getenv("REDIS_URL")
        if not self.redis_url:
            password = os.getenv("REDIS_PASSWORD")
            host = os.getenv("REDIS_HOST", "redis")
            port = os.getenv("REDIS_PORT", "6379")
            if password:
                self.redis_url = f"redis://:{password}@{host}:{port}"
            else:
                self.redis_url = f"redis://{host}:{port}"

        self.failure_threshold = int(os.getenv("CB_FAILURE_THRESHOLD", 5))
        self.recovery_timeout = int(os.getenv("CB_RECOVERY_TIMEOUT", 300)) # 5 minutes
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    async def is_open(self) -> bool:
        """Checks if the circuit is open (STT workflow should be stopped)."""
        r = await self._get_redis()

        # Check manual override from main-api (persisted in DB/synced via AI settings)
        # But we also allow a global kill switch in Redis
        is_killed = await r.get(f"cb:{self.service_name}:killed")
        if is_killed == b"1":
            return True

        status = await r.get(f"cb:{self.service_name}:status")
        if status == b"open":
            opened_at = await r.get(f"cb:{self.service_name}:opened_at")
            if opened_at:
                elapsed = time.time() - float(opened_at)
                if elapsed > self.recovery_timeout:
                    logger.info(f"Circuit breaker {self.service_name} timeout reached, moving to half-open")
                    await r.set(f"cb:{self.service_name}:status", "half-open")
                    return False
            return True
        return False

    async def record_failure(self, error: str = ""):
        """Records a failure and opens the circuit if threshold reached."""
        r = await self._get_redis()
        failures = await r.incr(f"cb:{self.service_name}:failures")

        if failures >= self.failure_threshold:
            logger.error(f"Circuit breaker {self.service_name} OPENED due to {failures} failures. Last error: {error}")
            await r.set(f"cb:{self.service_name}:status", "open")
            await r.set(f"cb:{self.service_name}:opened_at", str(time.time()))
            await r.set(f"cb:{self.service_name}:last_error", error)

    async def record_success(self):
        """Records a success and resets the failure counter."""
        r = await self._get_redis()
        status = await r.get(f"cb:{self.service_name}:status")
        if status in [b"open", b"half-open"]:
            logger.info(f"Circuit breaker {self.service_name} CLOSED after success")
            await r.set(f"cb:{self.service_name}:status", "closed")

        await r.delete(f"cb:{self.service_name}:failures")
        await r.delete(f"cb:{self.service_name}:opened_at")

    async def set_manual_status(self, killed: bool):
        """Manually enable/disable the workflow."""
        r = await self._get_redis()
        if killed:
            await r.set(f"cb:{self.service_name}:killed", "1")
            logger.warning(f"Circuit breaker {self.service_name} MANUALLY KILLED")
        else:
            await r.delete(f"cb:{self.service_name}:killed")
            logger.info(f"Circuit breaker {self.service_name} MANUALLY ENABLED")
