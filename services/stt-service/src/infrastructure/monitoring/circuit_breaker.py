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

    def _get_key(self, key_type: str, company_id: Optional[str] = None) -> str:
        if company_id:
            return f"cb:{company_id}:{self.service_name}:{key_type}"
        return f"cb:{self.service_name}:{key_type}"

    async def get_state(self, company_id: Optional[str] = None) -> CircuitState:
        """Consolidates Redis flags into a single CircuitState."""
        r = await self._get_redis()

        # 1. Check KILLED state (manual override)
        is_killed = await r.get(self._get_key("killed", company_id))
        if is_killed == b"1":
            return CircuitState.KILLED

        # 2. Check automatic status
        status_raw = await r.get(self._get_key("status", company_id))
        if not status_raw:
            return CircuitState.CLOSED

        status_str = status_raw.decode("utf-8")

        if status_str == "open":
            opened_at = await r.get(self._get_key("opened_at", company_id))
            if opened_at:
                elapsed = time.time() - float(opened_at)
                if elapsed > self.recovery_timeout:
                    logger.info(f"Circuit breaker {self.service_name} recovery timeout reached for {company_id or 'global'}, moving to HALF-OPEN")
                    await r.set(self._get_key("status", company_id), "half-open")
                    return CircuitState.HALF_OPEN
            return CircuitState.OPEN

        if status_str == "half-open":
            return CircuitState.HALF_OPEN

        return CircuitState.CLOSED

    async def is_blocked(self, company_id: Optional[str] = None) -> bool:
        """Checks if the workflow should be halted."""
        state = await self.get_state(company_id)
        return state in [CircuitState.OPEN, CircuitState.KILLED]

    async def is_open(self, company_id: Optional[str] = None) -> bool:
        """Backward compatibility for is_open()."""
        return await self.is_blocked(company_id)

    async def record_failure(self, error: str = "", enabled: bool = True, company_id: Optional[str] = None):
        """Records a failure and opens the circuit if threshold reached."""
        if not enabled:
            # If breaker is disabled, we don't transition to OPEN automatically,
            # but we might still want to log failures.
            logger.debug(f"Circuit breaker {self.service_name} failure recorded (monitoring only) for {company_id or 'global'}: {error}")
            return

        r = await self._get_redis()
        failures = await r.incr(self._get_key("failures", company_id))

        if failures >= self.failure_threshold:
            logger.error(f"Circuit breaker {self.service_name} transitioned to OPEN for {company_id or 'global'} due to {failures} failures. Last error: {error}")
            await r.set(self._get_key("status", company_id), "open")
            await r.set(self._get_key("opened_at", company_id), str(time.time()))
            await r.set(self._get_key("last_error", company_id), error)

    async def record_success(self, company_id: Optional[str] = None):
        """Records a success and resets the circuit to CLOSED."""
        r = await self._get_redis()
        state = await self.get_state(company_id)

        if state in [CircuitState.OPEN, CircuitState.HALF_OPEN]:
            logger.info(f"Circuit breaker {self.service_name} transitioned to CLOSED for {company_id or 'global'} after success")
            await r.set(self._get_key("status", company_id), "closed")

        await r.delete(self._get_key("failures", company_id))
        await r.delete(self._get_key("opened_at", company_id))

    async def set_manual_status(self, killed: bool, company_id: Optional[str] = None):
        """Manually kill/enable the workflow (KILLED state)."""
        r = await self._get_redis()
        if killed:
            await r.set(self._get_key("killed", company_id), "1")
            logger.warning(f"Circuit breaker {self.service_name} state set to KILLED for {company_id or 'global'}")
        else:
            await r.delete(self._get_key("killed", company_id))
            # If we un-kill, it goes back to whatever its automatic status was (usually CLOSED)
            logger.info(f"Circuit breaker {self.service_name} KILLED state removed for {company_id or 'global'}")
