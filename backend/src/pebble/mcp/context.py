"""Per-request context passed to every MCP tool handler.

Populated by the auth layer once per HTTP request and read by tool
implementations to scope DB queries to the calling user.
"""

from contextvars import ContextVar, Token
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.api_key import APIKey
from pebble.models.user import User


@dataclass(frozen=True)
class MCPRequestContext:
    user: User
    api_key: APIKey
    db: AsyncSession


_ctx: ContextVar[MCPRequestContext | None] = ContextVar("mcp_ctx", default=None)


def set_context(ctx: MCPRequestContext) -> Token[MCPRequestContext | None]:
    return _ctx.set(ctx)


def reset_context(token: Token[MCPRequestContext | None]) -> None:
    _ctx.reset(token)


def get_context() -> MCPRequestContext:
    ctx = _ctx.get()
    if ctx is None:
        raise RuntimeError("MCP request context not set")
    return ctx
