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
