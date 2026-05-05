"""MCP server exposing Pebble financial data and budget operations."""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    name="pebble",
    instructions=(
        "Pebble is a personal finance app. Tools let you analyse the user's "
        "spending, accounts, and budgets, and create/edit/delete budget "
        "entries. Always confirm with the user before destructive budget "
        "operations. All amounts are USD strings (no currency conversion)."
    ),
)


def get_streamable_http_app():
    """Return a Starlette app that FastAPI can mount at /mcp."""
    return mcp.streamable_http_app()


# Register tools (must be imported AFTER `mcp` is defined)
from pebble.mcp import tools_read  # noqa: E402, F401
