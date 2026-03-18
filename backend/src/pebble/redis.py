import redis.asyncio as redis

from pebble.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True)

REFRESH_BLACKLIST_PREFIX = "blacklist:refresh:"


async def blacklist_refresh_token(jti: str, expires_in_seconds: int) -> None:
    """Add a refresh token's JTI to the blacklist until it would have expired."""
    await redis_client.setex(
        f"{REFRESH_BLACKLIST_PREFIX}{jti}", expires_in_seconds, "1"
    )


async def is_refresh_token_blacklisted(jti: str) -> bool:
    """Check if a refresh token has been revoked."""
    return await redis_client.exists(f"{REFRESH_BLACKLIST_PREFIX}{jti}") > 0
