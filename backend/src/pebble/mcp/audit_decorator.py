import functools
import logging
import time
from typing import Callable

from fastapi import HTTPException

from pebble.mcp.context import get_context
from pebble.services import mcp_audit

logger = logging.getLogger("pebble.mcp.audit")


def audited(tool_name: str) -> Callable:
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(**kwargs):
            ctx = get_context()
            t0 = time.perf_counter()
            try:
                result = await fn(**kwargs)
                latency = int((time.perf_counter() - t0) * 1000)
                try:
                    await mcp_audit.write_audit_entry(
                        user_id=ctx.user.id, api_key_id=ctx.api_key.id,
                        tool_name=tool_name, args=kwargs,
                        status="ok", latency_ms=latency,
                    )
                except Exception:
                    logger.exception("MCP audit write failed for %s", tool_name)
                return result
            except Exception as e:
                latency = int((time.perf_counter() - t0) * 1000)
                status = (
                    "denied"
                    if isinstance(e, HTTPException) and e.status_code == 403
                    else "error"
                )
                try:
                    await mcp_audit.write_audit_entry(
                        user_id=ctx.user.id, api_key_id=ctx.api_key.id,
                        tool_name=tool_name, args=kwargs,
                        status=status, latency_ms=latency,
                        error_message=str(e),
                    )
                except Exception:
                    logger.exception("MCP audit write failed for %s", tool_name)
                raise
        return wrapper
    return decorator
