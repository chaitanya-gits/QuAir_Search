from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Async-safe TTL cache with single-flight loading.

    The loader is invoked at most once per expiration window even when multiple
    concurrent callers request the value simultaneously.
    """

    __slots__ = ("_ttl", "_value", "_expires_at", "_lock", "_has_value")

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = max(0.0, float(ttl_seconds))
        self._value: T | None = None
        self._expires_at: float = 0.0
        self._has_value: bool = False
        self._lock = asyncio.Lock()

    async def get(self, loader: Callable[[], Awaitable[T]]) -> T:
        now = time.monotonic()
        if self._has_value and now < self._expires_at:
            return self._value  # type: ignore[return-value]

        async with self._lock:
            now = time.monotonic()
            if self._has_value and now < self._expires_at:
                return self._value  # type: ignore[return-value]
            value = await loader()
            self._value = value
            self._expires_at = now + self._ttl
            self._has_value = True
            return value

    def invalidate(self) -> None:
        self._value = None
        self._expires_at = 0.0
        self._has_value = False


class QueryResponseCache:
    """Bounded LRU cache with per-entry TTL, keyed by hashable tuples."""

    __slots__ = ("_ttl", "_max_entries", "_entries", "_lock")

    def __init__(self, *, ttl_seconds: float = 30.0, max_entries: int = 256) -> None:
        self._ttl = max(0.0, float(ttl_seconds))
        self._max_entries = max(1, int(max_entries))
        self._entries: OrderedDict[tuple, tuple[float, dict]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: tuple) -> dict | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        expires_at, payload = entry
        if time.monotonic() >= expires_at:
            self._entries.pop(key, None)
            return None
        self._entries.move_to_end(key)
        return payload

    async def set(self, key: tuple, payload: dict) -> None:
        async with self._lock:
            self._entries[key] = (time.monotonic() + self._ttl, payload)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)

    def invalidate(self) -> None:
        self._entries.clear()
