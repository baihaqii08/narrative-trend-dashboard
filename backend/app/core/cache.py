import time
import inspect
from functools import wraps
from typing import Callable, Any
import hashlib
import json

# Dictionary untuk menyimpan cache di RAM server
_CACHE_STORE = {}

def in_memory_cache(ttl_seconds: int = 120):
    """
    Decorator untuk meng-cache hasil response API di dalam memory RAM (Dictionary).
    Sangat berguna untuk endpoint agregasi (seperti Dashboard) yang memakan waktu query lama.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache_kwargs = {k: v for k, v in kwargs.items() if k not in ["db", "request", "response"]}
            serialized_kwargs = json.dumps(cache_kwargs, sort_keys=True, default=str)
            key_hash = hashlib.md5(serialized_kwargs.encode()).hexdigest()
            cache_key = f"{func.__name__}:{key_hash}"
            
            now = time.time()
            if cache_key in _CACHE_STORE:
                cached_data, timestamp = _CACHE_STORE[cache_key]
                if now - timestamp < ttl_seconds:
                    return cached_data
                else:
                    del _CACHE_STORE[cache_key]
                    
            result = await func(*args, **kwargs)
            _CACHE_STORE[cache_key] = (result, now)
            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache_kwargs = {k: v for k, v in kwargs.items() if k not in ["db", "request", "response"]}
            serialized_kwargs = json.dumps(cache_kwargs, sort_keys=True, default=str)
            key_hash = hashlib.md5(serialized_kwargs.encode()).hexdigest()
            cache_key = f"{func.__name__}:{key_hash}"
            
            now = time.time()
            if cache_key in _CACHE_STORE:
                cached_data, timestamp = _CACHE_STORE[cache_key]
                if now - timestamp < ttl_seconds:
                    return cached_data
                else:
                    del _CACHE_STORE[cache_key]
                    
            result = func(*args, **kwargs)
            _CACHE_STORE[cache_key] = (result, now)
            return result

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
