import time
from collections import defaultdict, deque


class MCPRateLimiter:
    def __init__(self, per_minute: int = 60, per_day: int = 1000):
        self.per_minute = per_minute
        self.per_day = per_day
        self._minute: dict[str, deque] = defaultdict(deque)
        self._day: dict[str, deque] = defaultdict(deque)

    def check(self, key_id: str) -> int | None:
        """Return None if allowed, else seconds-to-retry."""
        now = time.monotonic()
        m = self._minute[key_id]
        d = self._day[key_id]
        while m and now - m[0] > 60:
            m.popleft()
        while d and now - d[0] > 86400:
            d.popleft()
        if len(m) >= self.per_minute:
            return int(60 - (now - m[0])) + 1
        if len(d) >= self.per_day:
            return int(86400 - (now - d[0])) + 1
        m.append(now)
        d.append(now)
        return None


_limiter = MCPRateLimiter()


def check_or_raise(key_id: str) -> None:
    retry_after = _limiter.check(key_id)
    if retry_after is None:
        return
    from fastapi import HTTPException
    raise HTTPException(
        status_code=429,
        detail="Rate limit exceeded",
        headers={"Retry-After": str(retry_after)},
    )
