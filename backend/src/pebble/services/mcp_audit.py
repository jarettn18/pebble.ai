from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.audit_log import MCPAuditLog


def _redact(args: dict) -> dict:
    """Drop oversized values so audit rows stay small."""
    out = {}
    for k, v in args.items():
        if isinstance(v, str) and len(v) > 200:
            out[k] = f"<truncated {len(v)} chars>"
        else:
            out[k] = v
    return out


async def write_audit_entry(
    *,
    db: AsyncSession,
    user_id,
    api_key_id,
    tool_name: str,
    args: dict,
    status: str,
    latency_ms: int,
    error_message: str | None = None,
) -> None:
    entry = MCPAuditLog(
        user_id=user_id,
        api_key_id=api_key_id,
        tool_name=tool_name,
        args=_redact(args),
        status=status,
        latency_ms=latency_ms,
        error_message=error_message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
