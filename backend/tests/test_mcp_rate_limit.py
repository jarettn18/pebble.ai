import pytest
from pebble.mcp.rate_limit import MCPRateLimiter


def test_allows_under_limit():
    rl = MCPRateLimiter(per_minute=3, per_day=100)
    for _ in range(3):
        assert rl.check("k1") is None


def test_blocks_when_minute_limit_exceeded():
    rl = MCPRateLimiter(per_minute=2, per_day=100)
    rl.check("k1")
    rl.check("k1")
    retry_after = rl.check("k1")
    assert retry_after is not None and retry_after > 0


def test_per_key_isolation():
    rl = MCPRateLimiter(per_minute=1, per_day=100)
    rl.check("a")
    assert rl.check("b") is None


def test_blocks_when_day_limit_exceeded():
    rl = MCPRateLimiter(per_minute=100, per_day=2)
    rl.check("k1")
    rl.check("k1")
    retry_after = rl.check("k1")
    assert retry_after is not None
    # Day window is 86400s; retry should be in that ballpark
    assert 86000 <= retry_after <= 86401


def test_sliding_window_expiry(monkeypatch):
    fake_now = [1000.0]
    monkeypatch.setattr("pebble.mcp.rate_limit.time.monotonic", lambda: fake_now[0])
    rl = MCPRateLimiter(per_minute=2, per_day=100)
    assert rl.check("k1") is None
    assert rl.check("k1") is None
    assert rl.check("k1") is not None  # 3rd is blocked
    fake_now[0] += 61  # advance past minute window
    assert rl.check("k1") is None  # allowed again


def test_check_or_raise_returns_none_when_allowed():
    from pebble.mcp.rate_limit import _limiter, check_or_raise
    _limiter._minute.clear()
    _limiter._day.clear()
    # under default 60/min, 1000/day, first call should not raise
    assert check_or_raise("test-key") is None


def test_check_or_raise_raises_when_exceeded():
    from fastapi import HTTPException
    from pebble.mcp.rate_limit import _limiter, check_or_raise
    # Replace module limiter with a tiny one for this test
    saved = (_limiter.per_minute, _limiter.per_day)
    _limiter.per_minute = 1
    _limiter.per_day = 100
    _limiter._minute.clear()
    _limiter._day.clear()
    try:
        assert check_or_raise("test-key") is None
        with pytest.raises(HTTPException) as exc_info:
            check_or_raise("test-key")
        assert exc_info.value.status_code == 429
        assert exc_info.value.headers["Retry-After"]
    finally:
        _limiter.per_minute, _limiter.per_day = saved
        _limiter._minute.clear()
        _limiter._day.clear()
