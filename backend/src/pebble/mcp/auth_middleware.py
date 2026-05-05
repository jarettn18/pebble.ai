"""Starlette middleware that authenticates every MCP request via API key
and populates MCPRequestContext."""

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from pebble.database import async_session
from pebble.mcp.context import MCPRequestContext, reset_context, set_context
from pebble.middleware.api_key_auth import authenticate_api_key


class MCPAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        auth = request.headers.get("authorization", "")
        if not auth.lower().startswith("bearer "):
            return JSONResponse(
                {"error": "Missing or malformed Authorization header"},
                status_code=401,
            )
        raw_key = auth[len("bearer "):].strip()

        async with async_session() as db:
            try:
                user, key = await authenticate_api_key(raw_key, db)
            except HTTPException as e:
                return JSONResponse(
                    {"error": e.detail}, status_code=e.status_code
                )

            token = set_context(MCPRequestContext(user=user, api_key=key, db=db))
            try:
                return await call_next(request)
            finally:
                reset_context(token)
