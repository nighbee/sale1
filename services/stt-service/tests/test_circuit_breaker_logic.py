import pytest
import asyncio
import time
import os
from unittest.mock import MagicMock, AsyncMock, patch
from src.infrastructure.monitoring.circuit_breaker import CircuitBreaker, CircuitState, CircuitBreakerError
from src.core.usecases.process_audio import ProcessAudioUseCase

class MockRedis:
    def __init__(self):
        self.data = {}

    async def get(self, key):
        return self.data.get(key)

    async def set(self, key, value):
        self.data[key] = value.encode() if isinstance(value, str) else str(value).encode()

    async def delete(self, key):
        self.data.pop(key, None)

    async def incr(self, key):
        val = int(self.data.get(key, b"0").decode()) + 1
        self.data[key] = str(val).encode()
        return val

@pytest.fixture
def cb():
    breaker = CircuitBreaker("test_service")
    breaker._redis = MockRedis()
    return breaker

@pytest.mark.asyncio
async def test_circuit_breaker_states(cb):
    company_id = "test-company"
    # Initial state should be CLOSED
    assert await cb.get_state(company_id=company_id) == CircuitState.CLOSED
    assert not await cb.is_blocked(company_id=company_id)

    # Transition to OPEN
    cb.failure_threshold = 2
    await cb.record_failure("error 1", company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.CLOSED # threshold not reached

    await cb.record_failure("error 2", company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.OPEN
    assert await cb.is_blocked(company_id=company_id)

    # Check that global state is still CLOSED
    assert await cb.get_state() == CircuitState.CLOSED

    # Manual KILLED state
    await cb.set_manual_status(True, company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.KILLED
    assert await cb.is_blocked(company_id=company_id)

    await cb.set_manual_status(False, company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.OPEN # Should revert to OPEN as it was open before

    # Success closes the circuit
    await cb.record_success(company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.CLOSED
    assert not await cb.is_blocked(company_id=company_id)

@pytest.mark.asyncio
async def test_cb_disabled_behavior(cb):
    # Reset
    await cb.record_success()
    cb.failure_threshold = 2

    # Record failure with enabled=False should NOT open the circuit
    await cb.record_failure("error 1", enabled=False)
    await cb.record_failure("error 2", enabled=False)
    await cb.record_failure("error 3", enabled=False)

    assert await cb.get_state() == CircuitState.CLOSED

@pytest.mark.asyncio
async def test_process_audio_cb_logic():
    # Patch MinioClient before instantiating ProcessAudioUseCase
    with patch('src.core.usecases.process_audio.MinioClient') as mock_minio_cls:
        use_case = ProcessAudioUseCase()
        use_case.api_client = AsyncMock()
        use_case.circuit_breaker = AsyncMock()

        # 1. Test blocked state
        use_case.circuit_breaker.is_blocked.return_value = True
        use_case.circuit_breaker.get_state.return_value = CircuitState.OPEN

        with pytest.raises(CircuitBreakerError) as exc:
            await use_case.execute({"call_id": "test", "audio_url": "http://test.com"})

        assert exc.value.state == CircuitState.OPEN

        # 2. Test manual toggle does NOT kill
        use_case.circuit_breaker.is_blocked.return_value = False
        use_case.api_client.get_ai_settings.return_value = {"circuit_breaker_enabled": False}

        use_case.api_client.get_active_integrations = AsyncMock(return_value=[])

        with patch.object(use_case.circuit_breaker, 'set_manual_status', AsyncMock()) as mock_set:
            with patch.object(use_case, 'stt_provider_name', 'openai'):
                with patch('src.adapters.stt.factory.STTProviderFactory.create', return_value=MagicMock()):
                    with patch('src.core.usecases.process_audio.get_call_links', return_value=(None, None)):
                        try:
                            await use_case.execute({"call_id": "test", "company_id": "test-company", "audio_url": "http://test.com"})
                        except:
                            pass

            # Verify set_manual_status was NOT called with True (which was the bug)
            for call in mock_set.call_args_list:
                 assert call[0][0] is False

@pytest.mark.asyncio
async def test_recovery_timeout(cb):
    await cb.record_success()
    cb.failure_threshold = 1
    cb.recovery_timeout = 0.1 # Very short for test

    await cb.record_failure("fail")
    assert await cb.get_state() == CircuitState.OPEN

    # Wait for timeout
    await asyncio.sleep(0.2)

    assert await cb.get_state() == CircuitState.HALF_OPEN
    assert not await cb.is_blocked() # HALF_OPEN is not blocked

@pytest.mark.asyncio
async def test_circuit_breaker_bypass_when_disabled(cb):
    company_id = "test-company"
    cb.failure_threshold = 1

    # Transition to OPEN
    await cb.record_failure("error", company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.OPEN

    # Should be blocked if enabled (default)
    assert await cb.is_blocked(company_id=company_id) is True

    # Should NOT be blocked if disabled
    assert await cb.is_blocked(company_id=company_id, enabled=False) is False

    # Manual KILLED should ALWAYS block
    await cb.set_manual_status(True, company_id=company_id)
    assert await cb.get_state(company_id=company_id) == CircuitState.KILLED
    assert await cb.is_blocked(company_id=company_id, enabled=False) is True
