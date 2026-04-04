import os
import redis.asyncio as redis
import logging
import time
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"
    KILLED = "killed"

class CircuitBreakerError(Exception):
    """Raised when the circuit breaker halts the workflow."""
    def __init__(self, service_name: str, state: CircuitState, message: str = ""):
        self.service_name = service_name
        self.state = state
        self.message = message or f"Circuit breaker {service_name} is in state {state.value}"
        super().__init__(self.message)

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

    async def get_state(self) -> CircuitState:
        """Consolidates Redis flags into a single CircuitState."""
        r = await self._get_redis()

        # 1. Check KILLED state (manual override)
        is_killed = await r.get(f"cb:{self.service_name}:killed")
        if is_killed == b"1":
            return CircuitState.KILLED

        # 2. Check automatic status
        status_raw = await r.get(f"cb:{self.service_name}:status")
        if not status_raw:
            return CircuitState.CLOSED

        status_str = status_raw.decode("utf-8")

        if status_str == "open":
            opened_at = await r.get(f"cb:{self.service_name}:opened_at")
            if opened_at:
                elapsed = time.time() - float(opened_at)
                if elapsed > self.recovery_timeout:
                    logger.info(f"Circuit breaker {self.service_name} recovery timeout reached, moving to HALF-OPEN")
                    await r.set(f"cb:{self.service_name}:status", "half-open")
                    return CircuitState.HALF_OPEN
            return CircuitState.OPEN

        if status_str == "half-open":
            return CircuitState.HALF_OPEN

        return CircuitState.CLOSED

    async def is_blocked(self) -> bool:
        """Checks if the workflow should be halted."""
        state = await self.get_state()
        return state in [CircuitState.OPEN, CircuitState.KILLED]

    async def is_open(self) -> bool:
        """Backward compatibility for is_open()."""
        return await self.is_blocked()

    async def record_failure(self, error: str = "", enabled: bool = True):
        """Records a failure and opens the circuit if threshold reached."""
        if not enabled:
            # If breaker is disabled, we don't transition to OPEN automatically,
            # but we might still want to log failures.
            logger.debug(f"Circuit breaker {self.service_name} failure recorded (monitoring only): {error}")
            return

        r = await self._get_redis()
        failures = await r.incr(f"cb:{self.service_name}:failures")

        if failures >= self.failure_threshold:
            logger.error(f"Circuit breaker {self.service_name} transitioned to OPEN due to {failures} failures. Last error: {error}")
            await r.set(f"cb:{self.service_name}:status", "open")
            await r.set(f"cb:{self.service_name}:opened_at", str(time.time()))
            await r.set(f"cb:{self.service_name}:last_error", error)

    async def record_success(self):
        """Records a success and resets the circuit to CLOSED."""
        r = await self._get_redis()
        state = await self.get_state()

        if state in [CircuitState.OPEN, CircuitState.HALF_OPEN]:
            logger.info(f"Circuit breaker {self.service_name} transitioned to CLOSED after success")
            await r.set(f"cb:{self.service_name}:status", "closed")

        await r.delete(f"cb:{self.service_name}:failures")
        await r.delete(f"cb:{self.service_name}:opened_at")

    async def set_manual_status(self, killed: bool):
        """Manually kill/enable the workflow (KILLED state)."""
        r = await self._get_redis()
        if killed:
            await r.set(f"cb:{self.service_name}:killed", "1")
            logger.warning(f"Circuit breaker {self.service_name} state set to KILLED")
        else:
            await r.delete(f"cb:{self.service_name}:killed")
            # If we un-kill, it goes back to whatever its automatic status was (usually CLOSED)
            logger.info(f"Circuit breaker {self.service_name} KILLED state removed")
