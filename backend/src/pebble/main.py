import logging
import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from pebble.config import settings
from pebble.mcp.auth_middleware import MCPAuthMiddleware
from pebble.mcp.server import get_streamable_http_app
from pebble.routers import accounts, ai_chat, api_keys, assets, auth, budget_plans, budgets, categories, csv_import, dashboard, health_score, plaid, transactions

log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("pebble")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "%s %s %d %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

        if logger.isEnabledFor(logging.DEBUG):
            safe_headers = {
                k: v for k, v in request.headers.items()
                if k.lower() != "authorization"
            }
            content_length = response.headers.get("content-length", "unknown")
            logger.debug(
                "headers=%s query_params=%s response_size=%s",
                safe_headers,
                str(request.query_params),
                content_length,
            )

        return response


app = FastAPI(title="Pebble", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)

app.include_router(accounts.router)
app.include_router(ai_chat.router)
app.include_router(api_keys.router)
app.include_router(assets.router)
app.include_router(auth.router)
app.include_router(budget_plans.router)
app.include_router(budgets.router)
app.include_router(categories.router)
app.include_router(csv_import.router)
app.include_router(dashboard.router)
app.include_router(health_score.router)
app.include_router(plaid.router)
app.include_router(transactions.router)

mcp_app = get_streamable_http_app()
mcp_app.add_middleware(MCPAuthMiddleware)
app.mount("/mcp", mcp_app)


@app.get("/health")
async def health():
    return {"status": "ok"}
