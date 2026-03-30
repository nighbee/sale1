import time
import logging
import random
from functools import wraps
from typing import Callable, Any, Type, Union, Tuple

logger = logging.getLogger(__name__)

def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception
) -> Callable:
    """
    Exponential backoff retry decorator.

    :param max_attempts: Maximum number of attempts including the first one.
    :param base_delay: Initial delay between retries.
    :param max_delay: Maximum delay between retries.
    :param exceptions: Exception or tuple of exceptions to catch and retry on.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            attempt = 1
            delay = base_delay

            while attempt <= max_attempts:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(f"Failed after {max_attempts} attempts: {e}")
                        raise

                    jitter = random.uniform(0, 0.1 * delay)
                    wait_time = min(delay + jitter, max_delay)

                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed: {e}. "
                        f"Retrying in {wait_time:.2f}s..."
                    )

                    time.sleep(wait_time)
                    attempt += 1
                    delay *= 2  # Exponential backoff
            return None  # Should not reach here
        return wrapper
    return decorator
