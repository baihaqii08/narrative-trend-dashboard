import hashlib
import inspect
import json
import time
from functools import wraps
from typing import Any, Callable, Dict, Tuple


DEFAULT_CACHE_TTL_SECONDS = 120
EXCLUDED_CACHE_KWARGS = frozenset({"db", "request", "response"})

_CACHE_STORE: Dict[str, Tuple[Any, float]] = {}


def in_memory_cache(ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS) -> Callable:
    """Cache endpoint responses in memory for `ttl_seconds` to accelerate repeated aggregation queries."""
    def decorator(target_function: Callable) -> Callable:
        @wraps(target_function)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = _build_cache_key(target_function.__name__, kwargs)
            cached_value = _read_valid_cache_entry(cache_key, ttl_seconds)
            if cached_value is not None:
                return cached_value

            fresh_result = await target_function(*args, **kwargs)
            _store_cache_entry(cache_key, fresh_result)
            return fresh_result

        @wraps(target_function)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = _build_cache_key(target_function.__name__, kwargs)
            cached_value = _read_valid_cache_entry(cache_key, ttl_seconds)
            if cached_value is not None:
                return cached_value

            fresh_result = target_function(*args, **kwargs)
            _store_cache_entry(cache_key, fresh_result)
            return fresh_result

        if inspect.iscoroutinefunction(target_function):
            return async_wrapper
        return sync_wrapper

    return decorator


def _build_cache_key(function_name: str, kwargs: Dict[str, Any]) -> str:
    serializable_kwargs = {
        key: value
        for key, value in kwargs.items()
        if key not in EXCLUDED_CACHE_KWARGS
    }
    serialized_kwargs = json.dumps(serializable_kwargs, sort_keys=True, default=str)
    kwargs_hash = hashlib.md5(serialized_kwargs.encode()).hexdigest()
    return f"{function_name}:{kwargs_hash}"


def _read_valid_cache_entry(cache_key: str, ttl_seconds: int) -> Any:
    if cache_key not in _CACHE_STORE:
        return None

    cached_data, cached_timestamp = _CACHE_STORE[cache_key]
    current_timestamp = time.time()
    if current_timestamp - cached_timestamp < ttl_seconds:
        return cached_data

    del _CACHE_STORE[cache_key]
    return None


def _store_cache_entry(cache_key: str, result: Any) -> None:
    _CACHE_STORE[cache_key] = (result, time.time())


ttl_cache = in_memory_cache
