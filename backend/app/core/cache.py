from functools import wraps
import inspect
import time
from typing import Any, Callable, Dict, Optional, Tuple


DEFAULT_CACHE_TTL_SECONDS = 120
_MEMORY_CACHE: Dict[str, Tuple[float, Any]] = {}


def ttl_cache(ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS) -> Callable:
    """Cache endpoint responses in memory for `ttl_seconds` to reduce repeated remote DB round-trips."""
    def decorator(target_function: Callable) -> Callable:
        if inspect.iscoroutinefunction(target_function):
            @wraps(target_function)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                cache_key = _build_cache_key(target_function.__name__, kwargs)
                cached_hit = _get_valid_cached_entry(cache_key, ttl_seconds)
                if cached_hit is not None:
                    return cached_hit

                result = await target_function(*args, **kwargs)
                _store_cache_entry(cache_key, result)
                return result

            return async_wrapper

        @wraps(target_function)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = _build_cache_key(target_function.__name__, kwargs)
            cached_hit = _get_valid_cached_entry(cache_key, ttl_seconds)
            if cached_hit is not None:
                return cached_hit

            result = target_function(*args, **kwargs)
            _store_cache_entry(cache_key, result)
            return result

        return sync_wrapper

    return decorator


def clear_cache() -> None:
    _MEMORY_CACHE.clear()


def _build_cache_key(function_name: str, keyword_arguments: Dict[str, Any]) -> str:
    filtered_arguments = {
        argument_name: argument_value
        for argument_name, argument_value in keyword_arguments.items()
        if argument_name not in ("db", "neo4j_session")
    }
    sorted_items = sorted(filtered_arguments.items())
    return f"{function_name}:{repr(sorted_items)}"


def _get_valid_cached_entry(cache_key: str, ttl_seconds: int) -> Optional[Any]:
    cached_entry = _MEMORY_CACHE.get(cache_key)
    if cached_entry is None:
        return None

    cached_timestamp, cached_value = cached_entry
    is_within_ttl = (time.time() - cached_timestamp) < ttl_seconds
    if not is_within_ttl:
        return None

    return cached_value


def _store_cache_entry(cache_key: str, value: Any) -> None:
    _MEMORY_CACHE[cache_key] = (time.time(), value)
