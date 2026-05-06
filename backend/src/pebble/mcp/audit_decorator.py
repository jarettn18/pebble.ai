import functools
import time
from typing import Callable

from pebble.mcp.context import get_context
from pebble.services import mcp_audit


def audited(tool_name: str) -> Callable:
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(**kwargs):
            ctx = get_context()
            t0 = time.perf_counter()
            try:
                result = await fn(**kwargs)
                latency = int((time.perf_counter() - t0) * 1000)
                await mcp_audit.write_audit_entry(
                    db=ctx.db, user_id=ctx.user.id, api_key_id=ctx.api_key.id,
                    tool_name=tool_name, args=kwargs,
                    status="ok", latency_ms=latency,
                )
                return result
            except Exception as e:
                latency = int((time.perf_counter() - t0) * 1000)
                status = "denied" if "scope" in str(e).lower() else "error"
                await mcp_audit.write_audit_entry(
                    db=ctx.db, user_id=ctx.user.id, api_key_id=ctx.api_key.id,
                    tool_name=tool_name, args=kwargs,
                    status=status, latency_ms=latency,
                    error_message=str(e),
                )
                raise
        return wrapper
    return decorator
