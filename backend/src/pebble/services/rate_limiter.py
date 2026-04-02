import asyncio
import time

from fastapi import HTTPException, Request, status


class AsyncRateLimiter:
    """Token-bucket style async rate limiter.

    Args:
        rate: Maximum number of requests allowed per period.
        period: Time period in seconds (default 1.0).
    """

    def __init__(self, rate: float, period: float = 1.0):
        self._rate = rate
        self._period = period
        self._tokens = rate
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self._tokens = min(
                self._rate,
                self._tokens + elapsed * (self._rate / self._period),
            )
            self._last_refill = now

            if self._tokens < 1:
                wait = (1 - self._tokens) * (self._period / self._rate)
                await asyncio.sleep(wait)
                self._tokens = 0
            else:
                self._tokens -= 1


class RateLimitDependency:
    """Per-key sliding window rate limiter usable as a FastAPI dependency.

    Uses IP address for unauthenticated requests, user ID from JWT for
    authenticated requests.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self._max = max_requests
        self._window = window_seconds
        self._requests: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    def _get_key(self, request: Request) -> str:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            try:
                from jose import jwt

                payload = jwt.decode(
                    auth[7:], "dummy", options={"verify_signature": False}
                )
                if sub := payload.get("sub"):
                    return f"user:{sub}"
            except Exception:
                pass
        host = request.client.host if request.client else "unknown"
        return f"ip:{host}"

    async def __call__(self, request: Request) -> None:
        key = self._get_key(request)
        now = time.monotonic()

        async with self._lock:
            timestamps = self._requests.get(key, [])
            cutoff = now - self._window
            timestamps = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= self._max:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded, please try again later",
                )

            timestamps.append(now)
            self._requests[key] = timestamps
