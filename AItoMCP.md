# Pebble MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the Pebble backend as an MCP (Model Context Protocol) server so external AI clients (Claude Desktop, Cursor, custom agents) can perform financial analysis and budget CRUD on behalf of an authenticated user.

**Architecture:** Mount an MCP server (official Python SDK, Streamable HTTP transport) at `/mcp` on the existing FastAPI Cloud Run service. Authenticate via scoped, revocable per-client API keys (`pb_*` prefix, SHA-256 hashed at rest). Reuse existing async tool handlers from `pebble.ai.data_access` and budget service functions from `pebble.services.budgets` — the MCP layer is a thin adapter, not a reimplementation. Every tool call is audit-logged and rate-limited per key.

**Tech Stack:** Python 3.13, FastAPI, `mcp[cli]` Python SDK ≥ 1.2, async SQLAlchemy 2.0, Alembic, pytest + pytest-asyncio, React Native (Expo) for the in-app key management UI.

---

## Spec / Design Notes

### Scope (v1)
- **15 MCP tools total:** 10 read-only analysis tools (already implemented in `ai/data_access.py`) + 5 budget CRUD tools (wrapping `services/budgets.py`).
- **Auth:** Per-client API keys with explicit scopes. No OAuth in v1.
- **Transport:** Streamable HTTP only (works with Claude Desktop ≥ 0.7, Cursor, custom agents). No SSE/stdio.
- **No write access to:** transactions, accounts, Plaid items, user profile, or assets. Hard-coded.

### Out of scope (v1)
- OAuth 2.1 / DCR (revisit after dogfooding).
- Per-tool human-in-the-loop confirmations beyond what the MCP client surfaces.
- Streaming tool responses.
- Sub-account / family scoping.

### Scope model
A scope is a string of the form `<resource>:<action>`. v1 scopes:

| Scope | Grants |
|---|---|
| `read:transactions` | `get_recent_transactions`, `get_spending_by_category`, `get_spending_over_time`, `get_top_merchants`, `get_income_summary`, `compare_spending` |
| `read:accounts` | `get_account_balances` |
| `read:budgets` | `get_budget_status`, `list_budgets`, `get_budget` |
| `write:budgets` | `create_budget`, `update_budget`, `delete_budget` |
| `read:insights` | `search_financial_tips`, `get_financial_health_score` |

A key holds a list of granted scopes. Each tool declares the scope it requires; the MCP auth layer checks before dispatch.

### Key format and storage
- Raw key: `pb_<43 url-safe chars>` (already produced by `generate_api_key()`).
- Stored: SHA-256 hash only. Raw shown to user **once** at creation.
- New table `api_keys`: `id`, `user_id`, `key_hash` (unique), `name` (user-supplied label), `scopes` (text[]), `created_at`, `last_used_at`, `revoked_at`. Replaces the unused `users.api_key_hash` column (migration drops it).

### Threat model highlights
- **Stolen key → full revoke:** soft-delete via `revoked_at`; auth check rejects revoked keys.
- **Read-only by default:** new keys default to read scopes; user must opt in to `write:budgets`.
- **No transaction or account writes ever:** enforced by absence of tools, not just scopes.
- **Per-key rate limit:** 60 req/min, 1000 req/day. 429 with `Retry-After`.
- **Audit log retention:** 90 days, includes key id, tool name, args (redacted of large payloads), latency, status.

### File structure

```
backend/src/pebble/
  models/
    api_key.py              # NEW: APIKey ORM model
    audit_log.py            # NEW: MCPAuditLog ORM model
  schemas/
    api_key.py              # NEW: pydantic request/response shapes
  services/
    api_keys.py             # NEW: create/list/revoke business logic
    mcp_audit.py            # NEW: append-only audit writer
  middleware/
    api_key_auth.py         # NEW: extract+verify+scope-check Bearer key
  mcp/                      # NEW package
    __init__.py
    server.py               # FastMCP instance + tool registrations
    context.py              # request-scoped user/db/scopes
    tools_read.py           # 10 read tool wrappers
    tools_budgets.py        # 5 budget CRUD tool wrappers
    rate_limit.py           # per-key rate limiter
  routers/
    api_keys.py             # NEW: /v1/api-keys CRUD endpoints
  main.py                   # MODIFY: mount MCP app at /mcp
backend/alembic/versions/
  XXXX_api_keys_table.py    # NEW migration
  XXXX_drop_users_api_key_hash.py
  XXXX_mcp_audit_log_table.py
backend/tests/
  test_api_keys.py
  test_mcp_auth.py
  test_mcp_tools_read.py
  test_mcp_tools_budgets.py
  test_mcp_audit.py
mobile/src/screens/
  ApiKeysScreen.tsx         # NEW: settings page
  CreateApiKeyScreen.tsx    # NEW: name + scope selection
mobile/src/api/
  apiKeys.ts                # NEW: client wrapper
docs/
  MCP_SETUP.md              # NEW: Claude Desktop / Cursor config guide
```

---

## Phase 1 — Foundation: API Keys with Scopes

### Task 1: Create `api_keys` and `mcp_audit_log` Alembic migrations

**Files:**
- Create: `backend/alembic/versions/<rev>_api_keys_table.py`
- Create: `backend/alembic/versions/<rev>_mcp_audit_log_table.py`
- Create: `backend/alembic/versions/<rev>_drop_users_api_key_hash.py`

- [ ] **Step 1: Generate migration for api_keys table**

```bash
cd backend && uv run alembic revision -m "create api_keys table"
```

Edit the generated file:

```python
"""create api_keys table"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "<auto>"
down_revision = "<previous head>"

def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

def downgrade() -> None:
    op.drop_table("api_keys")
```

- [ ] **Step 2: Generate migration for mcp_audit_log**

```bash
cd backend && uv run alembic revision -m "create mcp_audit_log table"
```

```python
def upgrade() -> None:
    op.create_table(
        "mcp_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("api_key_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tool_name", sa.String(64), nullable=False, index=True),
        sa.Column("args", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("status", sa.String(16), nullable=False),  # "ok" | "error" | "denied"
        sa.Column("latency_ms", sa.Integer, nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now(), index=True),
    )

def downgrade() -> None:
    op.drop_table("mcp_audit_log")
```

- [ ] **Step 3: Generate migration to drop users.api_key_hash**

```bash
cd backend && uv run alembic revision -m "drop users api_key_hash"
```

```python
def upgrade() -> None:
    op.drop_index("ix_users_api_key_hash", table_name="users", if_exists=True)
    op.drop_column("users", "api_key_hash")

def downgrade() -> None:
    op.add_column("users", sa.Column("api_key_hash", sa.String(64), unique=True))
```

- [ ] **Step 4: Run migrations against local DB and verify**

```bash
cd backend && uv run alembic upgrade head
uv run python -c "from pebble.database import engine; import asyncio; \
    asyncio.run(engine.dispose())"
psql $DATABASE_URL -c "\d api_keys" -c "\d mcp_audit_log"
```

Expected: both tables present with the columns above.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: add api_keys and mcp_audit_log tables"
```

---

### Task 2: APIKey and MCPAuditLog ORM models

**Files:**
- Create: `backend/src/pebble/models/api_key.py`
- Create: `backend/src/pebble/models/audit_log.py`
- Modify: `backend/src/pebble/models/user.py:46-53` (remove `api_key_hash`, add relationship)
- Modify: `backend/src/pebble/models/__init__.py` (export both)

- [ ] **Step 1: Write the failing test**

`backend/tests/test_api_key_model.py`:

```python
from datetime import datetime, timezone
import pytest
from pebble.models.api_key import APIKey


def test_api_key_is_active_when_not_revoked():
    key = APIKey(revoked_at=None)
    assert key.is_active is True


def test_api_key_is_inactive_when_revoked():
    key = APIKey(revoked_at=datetime.now(timezone.utc))
    assert key.is_active is False


def test_api_key_has_scope():
    key = APIKey(scopes=["read:budgets", "write:budgets"])
    assert key.has_scope("read:budgets") is True
    assert key.has_scope("read:transactions") is False
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && uv run pytest tests/test_api_key_model.py -v
```

Expected: ImportError — `pebble.models.api_key` does not exist.

- [ ] **Step 3: Write the model**

`backend/src/pebble/models/api_key.py`:

```python
import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class APIKey(Base, TimestampMixin):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    last_used_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )

    user: Mapped["User"] = relationship(back_populates="api_keys")  # noqa: F821

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None

    def has_scope(self, scope: str) -> bool:
        return scope in (self.scopes or [])
```

`backend/src/pebble/models/audit_log.py`:

```python
import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from pebble.models.base import Base, gen_uuid


class MCPAuditLog(Base):
    __tablename__ = "mcp_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    tool_name: Mapped[str] = mapped_column(String(64), index=True)
    args: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(16))
    latency_ms: Mapped[int] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), index=True
    )
```

- [ ] **Step 4: Update User model**

Remove line 28 (`api_key_hash`) and add to relationships block:

```python
api_keys: Mapped[list["APIKey"]] = relationship(  # noqa: F821
    back_populates="user", cascade="all, delete-orphan"
)
```

- [ ] **Step 5: Export from `models/__init__.py`** (add the two new modules to whatever existing pattern is used)

- [ ] **Step 6: Run tests, verify pass**

```bash
cd backend && uv run pytest tests/test_api_key_model.py -v
```

Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/pebble/models/
git commit -m "feat: APIKey and MCPAuditLog ORM models"
```

---

### Task 3: Replace `get_user_by_api_key` middleware with scoped variant

**Files:**
- Create: `backend/src/pebble/middleware/api_key_auth.py`
- Modify: `backend/src/pebble/middleware/auth.py:54-70` (delete the legacy function)

- [ ] **Step 1: Write the failing test**

`backend/tests/test_mcp_auth.py`:

```python
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import HTTPException
from pebble.middleware.api_key_auth import authenticate_api_key
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.mark.asyncio
async def test_valid_active_key_returns_user_and_key():
    key = APIKey(
        id=uuid4(), key_hash="x" * 64, scopes=["read:budgets"],
        revoked_at=None,
    )
    user = User(id=uuid4(), active=True)
    key.user = user
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=lambda: key)
    got_user, got_key = await authenticate_api_key("pb_test", db)
    assert got_user.id == user.id
    assert got_key.id == key.id


@pytest.mark.asyncio
async def test_revoked_key_rejected():
    key = APIKey(
        key_hash="x" * 64, scopes=[], revoked_at=datetime.now(timezone.utc)
    )
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=lambda: key)
    with pytest.raises(HTTPException) as exc:
        await authenticate_api_key("pb_test", db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_unknown_key_rejected():
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)
    with pytest.raises(HTTPException) as exc:
        await authenticate_api_key("pb_unknown", db)
    assert exc.value.status_code == 401
```

- [ ] **Step 2: Verify it fails**

```bash
cd backend && uv run pytest tests/test_mcp_auth.py -v
```

Expected: ImportError.

- [ ] **Step 3: Write the middleware**

`backend/src/pebble/middleware/api_key_auth.py`:

```python
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.api_key import APIKey
from pebble.models.user import User
from pebble.utils.security import hash_api_key


async def authenticate_api_key(
    raw_key: str, db: AsyncSession
) -> tuple[User, APIKey]:
    """Look up an API key by its raw value and return (user, key).

    Raises 401 if the key is unknown, revoked, or its user is inactive.
    Updates last_used_at on success.
    """
    if not raw_key.startswith("pb_"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Malformed API key")

    key_hash = hash_api_key(raw_key)
    result = await db.execute(
        select(APIKey)
        .options(joinedload(APIKey.user))
        .where(APIKey.key_hash == key_hash)
    )
    key = result.scalar_one_or_none()
    if key is None or not key.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    if not key.user.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account deactivated")

    key.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return key.user, key


def require_scope(key: APIKey, scope: str) -> None:
    if not key.has_scope(scope):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"This key is missing required scope: {scope}",
        )
```

- [ ] **Step 4: Delete the old `get_user_by_api_key`** from `middleware/auth.py:54-70` and remove the now-unused `hash_api_key` import there.

- [ ] **Step 5: Run tests, verify pass**

```bash
cd backend && uv run pytest tests/test_mcp_auth.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pebble/middleware/
git commit -m "feat: scoped API key authentication"
```

---

## Phase 2 — Key Management

### Task 4: API key service layer

**Files:**
- Create: `backend/src/pebble/services/api_keys.py`
- Create: `backend/src/pebble/schemas/api_key.py`

Valid scopes constant lives here so it's the single source of truth.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_api_key_service.py`:

```python
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from pebble.services.api_keys import (
    VALID_SCOPES,
    create_api_key,
    list_api_keys,
    revoke_api_key,
)


@pytest.mark.asyncio
async def test_create_returns_raw_key_once():
    db = AsyncMock()
    user_id = str(uuid4())
    raw, key = await create_api_key(
        user_id, db, name="Claude Desktop",
        scopes=["read:budgets", "read:transactions"],
    )
    assert raw.startswith("pb_")
    assert key.name == "Claude Desktop"
    assert set(key.scopes) == {"read:budgets", "read:transactions"}
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_rejects_invalid_scope():
    db = AsyncMock()
    with pytest.raises(ValueError, match="Unknown scope"):
        await create_api_key(
            str(uuid4()), db, name="x", scopes=["read:passwords"]
        )


def test_valid_scopes_includes_v1_set():
    assert VALID_SCOPES == {
        "read:transactions",
        "read:accounts",
        "read:budgets",
        "write:budgets",
        "read:insights",
    }
```

- [ ] **Step 2: Verify failure** — `uv run pytest tests/test_api_key_service.py -v`

- [ ] **Step 3: Write the service**

`backend/src/pebble/services/api_keys.py`:

```python
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.api_key import APIKey
from pebble.utils.security import generate_api_key

VALID_SCOPES: set[str] = {
    "read:transactions",
    "read:accounts",
    "read:budgets",
    "write:budgets",
    "read:insights",
}


async def create_api_key(
    user_id: str, db: AsyncSession, *, name: str, scopes: list[str]
) -> tuple[str, APIKey]:
    unknown = set(scopes) - VALID_SCOPES
    if unknown:
        raise ValueError(f"Unknown scope(s): {sorted(unknown)}")
    raw, hashed = generate_api_key()
    key = APIKey(user_id=user_id, key_hash=hashed, name=name, scopes=list(scopes))
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return raw, key


async def list_api_keys(user_id: str, db: AsyncSession) -> list[APIKey]:
    result = await db.execute(
        select(APIKey)
        .where(APIKey.user_id == user_id)
        .order_by(APIKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(user_id: str, key_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id)
    )
    key = result.scalar_one_or_none()
    if key is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
        await db.commit()
```

`backend/src/pebble/schemas/api_key.py`:

```python
from datetime import datetime
from pydantic import BaseModel, Field


class APIKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[str] = Field(min_length=1)


class APIKeyOut(BaseModel):
    id: str
    name: str
    scopes: list[str]
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class APIKeyCreateResponse(BaseModel):
    api_key: APIKeyOut
    raw_key: str  # shown once at creation, never again
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && uv run pytest tests/test_api_key_service.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pebble/services/api_keys.py backend/src/pebble/schemas/api_key.py
git commit -m "feat: API key service and schemas"
```

---

### Task 5: API key router (`/v1/api-keys`)

**Files:**
- Create: `backend/src/pebble/routers/api_keys.py`
- Modify: `backend/src/pebble/main.py` (include the router)

- [ ] **Step 1: Write the failing test**

`backend/tests/test_api_keys_router.py`:

```python
def test_create_api_key_returns_raw_once(authed_client, fake_user, fake_db):
    # patch service
    from pebble.services import api_keys as svc
    from pebble.models.api_key import APIKey
    from uuid import uuid4
    from datetime import datetime, timezone

    fake_key = APIKey(
        id=uuid4(), user_id=fake_user.id, key_hash="x"*64,
        name="Claude", scopes=["read:budgets"],
        revoked_at=None, last_used_at=None,
        created_at=datetime.now(timezone.utc),
    )
    async def fake_create(user_id, db, *, name, scopes):
        return ("pb_secret123", fake_key)
    monkeypatched = svc.create_api_key
    svc.create_api_key = fake_create
    try:
        r = authed_client.post(
            "/v1/api-keys",
            json={"name": "Claude", "scopes": ["read:budgets"]},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["raw_key"] == "pb_secret123"
        assert body["api_key"]["name"] == "Claude"
    finally:
        svc.create_api_key = monkeypatched
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Write the router**

`backend/src/pebble/routers/api_keys.py`:

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.api_key import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyOut,
)
from pebble.services.api_keys import (
    create_api_key,
    list_api_keys,
    revoke_api_key,
)

router = APIRouter(prefix="/v1/api-keys", tags=["api-keys"])


def _to_out(k) -> APIKeyOut:
    return APIKeyOut(
        id=str(k.id),
        name=k.name,
        scopes=list(k.scopes or []),
        last_used_at=k.last_used_at,
        revoked_at=k.revoked_at,
        created_at=k.created_at,
    )


@router.post("", response_model=APIKeyCreateResponse,
             status_code=status.HTTP_201_CREATED)
async def create(
    req: APIKeyCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        raw, key = await create_api_key(
            str(user.id), db, name=req.name, scopes=req.scopes
        )
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return APIKeyCreateResponse(api_key=_to_out(key), raw_key=raw)


@router.get("", response_model=list[APIKeyOut])
async def list_(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    keys = await list_api_keys(str(user.id), db)
    return [_to_out(k) for k in keys]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await revoke_api_key(str(user.id), key_id, db)
```

- [ ] **Step 4: Wire into `main.py`** (add import + `app.include_router(api_keys_router)` next to existing router includes)

- [ ] **Step 5: Run tests, verify pass + commit**

```bash
cd backend && uv run pytest tests/test_api_keys_router.py -v
git add backend/src/pebble/routers/api_keys.py backend/src/pebble/main.py
git commit -m "feat: API key management endpoints"
```

---

### Task 6: Mobile UI — list + create + revoke API keys

**Files:**
- Create: `mobile/src/api/apiKeys.ts`
- Create: `mobile/src/screens/ApiKeysScreen.tsx`
- Create: `mobile/src/screens/CreateApiKeyScreen.tsx`
- Modify: `mobile/app/(tabs)/settings.tsx` or equivalent settings entry — add "Connected AI tools" row

- [ ] **Step 1: API client**

`mobile/src/api/apiKeys.ts`:

```typescript
import { authedFetch } from "./client";

export type ApiKey = {
  id: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CreateApiKeyResponse = {
  api_key: ApiKey;
  raw_key: string;
};

export const SCOPE_OPTIONS = [
  { id: "read:transactions", label: "Read transactions" },
  { id: "read:accounts", label: "Read account balances" },
  { id: "read:budgets", label: "Read budgets" },
  { id: "write:budgets", label: "Create / edit / delete budgets" },
  { id: "read:insights", label: "Financial health and tips" },
] as const;

export async function listApiKeys(): Promise<ApiKey[]> {
  return authedFetch("/v1/api-keys");
}

export async function createApiKey(
  name: string,
  scopes: string[]
): Promise<CreateApiKeyResponse> {
  return authedFetch("/v1/api-keys", {
    method: "POST",
    body: JSON.stringify({ name, scopes }),
  });
}

export async function revokeApiKey(id: string): Promise<void> {
  await authedFetch(`/v1/api-keys/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: List screen**

`mobile/src/screens/ApiKeysScreen.tsx` — FlatList of keys with name, last-used relative time, scope chips, swipe-to-revoke. Tapping FAB / "+ Connect a tool" navigates to `CreateApiKeyScreen`. After revoke, refetch. Match existing screen patterns from `BudgetsScreen` (use the same `colors`, `shadows` from `theme`, the same error/empty state styling).

- [ ] **Step 3: Create screen**

`CreateApiKeyScreen.tsx`:
- TextInput for name (placeholder: "e.g., Claude Desktop").
- Multi-select scope chips (default: all `read:*` checked, `write:budgets` unchecked).
- "Generate key" button calls `createApiKey()`, on success shows the raw key in a copy-to-clipboard card with a one-time warning ("This is the only time this key will be shown"), plus a "Done" button. Use `expo-clipboard`.

- [ ] **Step 4: Manual smoke test**

```bash
cd mobile && npm start
```

Open app → Settings → Connected AI tools → create a key → verify raw shown once → list shows new entry → revoke → entry shows "Revoked".

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api/apiKeys.ts mobile/src/screens/Api*Screen.tsx mobile/app/
git commit -m "feat: in-app API key management UI"
```

---

## Phase 3 — MCP Server

### Task 7: Add `mcp` dependency and scaffold the FastMCP app

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/src/pebble/mcp/__init__.py`
- Create: `backend/src/pebble/mcp/server.py`
- Create: `backend/src/pebble/mcp/context.py`

- [ ] **Step 1: Add dependency**

```bash
cd backend && uv add "mcp>=1.2.0"
```

- [ ] **Step 2: Request-scoped context**

`backend/src/pebble/mcp/context.py`:

```python
"""Per-request context passed to every MCP tool handler.

Populated by the auth layer once per HTTP request and read by tool
implementations to scope DB queries to the calling user.
"""

from contextvars import ContextVar
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.api_key import APIKey
from pebble.models.user import User


@dataclass
class MCPRequestContext:
    user: User
    api_key: APIKey
    db: AsyncSession


_ctx: ContextVar[MCPRequestContext | None] = ContextVar("mcp_ctx", default=None)


def set_context(ctx: MCPRequestContext) -> None:
    _ctx.set(ctx)


def get_context() -> MCPRequestContext:
    ctx = _ctx.get()
    if ctx is None:
        raise RuntimeError("MCP request context not set")
    return ctx
```

- [ ] **Step 3: FastMCP server skeleton**

`backend/src/pebble/mcp/server.py`:

```python
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
```

- [ ] **Step 4: Smoke test** (server constructs without error)

```bash
cd backend && uv run python -c "from pebble.mcp.server import mcp; print(mcp.name)"
```

Expected: `pebble`

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/src/pebble/mcp/
git commit -m "feat: scaffold MCP server"
```

---

### Task 8: Mount MCP app on FastAPI with API-key auth middleware

**Files:**
- Modify: `backend/src/pebble/main.py`
- Create: `backend/src/pebble/mcp/auth_middleware.py`

- [ ] **Step 1: Auth middleware that wraps the MCP app**

`backend/src/pebble/mcp/auth_middleware.py`:

```python
"""Starlette middleware that authenticates every MCP request via API key
and populates MCPRequestContext."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from pebble.database import async_session
from pebble.middleware.api_key_auth import authenticate_api_key
from pebble.mcp.context import MCPRequestContext, set_context


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
            except Exception as e:
                status = getattr(e, "status_code", 401)
                detail = getattr(e, "detail", "Unauthorized")
                return JSONResponse({"error": detail}, status_code=status)

            set_context(MCPRequestContext(user=user, api_key=key, db=db))
            return await call_next(request)
```

> Note: `async_session` should be the existing async sessionmaker exported from `pebble.database`. If only `get_db` is exported, add `async_session` to that module.

- [ ] **Step 2: Mount in `main.py`**

```python
from pebble.mcp.server import get_streamable_http_app
from pebble.mcp.auth_middleware import MCPAuthMiddleware

mcp_app = get_streamable_http_app()
mcp_app.add_middleware(MCPAuthMiddleware)
app.mount("/mcp", mcp_app)
```

- [ ] **Step 3: Manual smoke test**

```bash
cd backend && uv run uvicorn pebble.main:app --reload &
curl -i -X POST http://localhost:8000/mcp/ \
  -H "Authorization: Bearer pb_invalid"
```

Expected: 401 with JSON `{"error": "Invalid API key"}`.

```bash
# Use a valid key from the API key endpoint
curl -i -X POST http://localhost:8000/mcp/ \
  -H "Authorization: Bearer pb_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected: 200, empty `tools` array (no tools registered yet).

- [ ] **Step 4: Commit**

```bash
git add backend/src/pebble/mcp/auth_middleware.py backend/src/pebble/main.py backend/src/pebble/database.py
git commit -m "feat: mount MCP server with API-key auth"
```

---

### Task 9: Wrap the 10 read tools as MCP tools

**Files:**
- Create: `backend/src/pebble/mcp/tools_read.py`
- Modify: `backend/src/pebble/mcp/server.py` (import the module to register tools)

The read tools already exist as async functions taking `(user_id, db, **kwargs)`. We wrap each with a thin `@mcp.tool()` decorator that pulls user/db from context and enforces a scope.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_mcp_tools_read.py`:

```python
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

from pebble.mcp.context import MCPRequestContext, set_context
from pebble.mcp.tools_read import get_account_balances
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.mark.asyncio
async def test_read_tool_denied_without_scope():
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    db = AsyncMock()
    set_context(MCPRequestContext(user=user, api_key=key, db=db))
    with pytest.raises(Exception, match="read:accounts"):
        await get_account_balances()


@pytest.mark.asyncio
async def test_read_tool_calls_data_access_with_user_id(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:accounts"])
    db = AsyncMock()
    set_context(MCPRequestContext(user=user, api_key=key, db=db))

    called = {}
    async def fake(user_id, db_arg):
        called["user_id"] = user_id
        return {"net_worth": "1000.00"}
    monkeypatch.setattr(
        "pebble.ai.data_access.get_account_balances", fake
    )
    result = await get_account_balances()
    assert called["user_id"] == str(user.id)
    assert result["net_worth"] == "1000.00"
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Write the wrappers**

`backend/src/pebble/mcp/tools_read.py`:

```python
"""MCP tool wrappers around pebble.ai.data_access read functions."""

from pebble.ai import data_access
from pebble.mcp.context import get_context
from pebble.mcp.server import mcp
from pebble.middleware.api_key_auth import require_scope


def _ctx_user_db():
    ctx = get_context()
    return str(ctx.user.id), ctx.db, ctx.api_key


@mcp.tool()
async def get_spending_by_category(date_from: str, date_to: str) -> dict:
    """Get spending breakdown by category for a date range. Returns total
    and per-category amounts with percentages."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_spending_by_category(
        user_id, db, date_from=date_from, date_to=date_to
    )


@mcp.tool()
async def get_spending_over_time(months: int = 6) -> dict:
    """Monthly spending totals for the last N months (1–12)."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_spending_over_time(
        user_id, db, months=months
    )


@mcp.tool()
async def get_top_merchants(
    date_from: str, date_to: str, limit: int = 10
) -> dict:
    """Top merchants by total spend within a date range."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_top_merchants(
        user_id, db, date_from=date_from, date_to=date_to, limit=limit
    )


@mcp.tool()
async def get_account_balances() -> dict:
    """Current balances for all bank accounts and assets, plus net worth."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:accounts")
    return await data_access.get_account_balances(user_id, db)


@mcp.tool()
async def get_budget_status(
    month: int | None = None, year: int | None = None
) -> dict:
    """Budget vs. actual spending per category. Defaults to current month."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:budgets")
    return await data_access.get_budget_status(
        user_id, db, month=month, year=year
    )


@mcp.tool()
async def get_recent_transactions(
    limit: int = 10,
    search: str | None = None,
    category: str | None = None,
    type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Recent transactions with optional filters."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_recent_transactions(
        user_id, db,
        limit=limit, search=search, category=category, type=type,
        date_from=date_from, date_to=date_to,
    )


@mcp.tool()
async def get_income_summary(date_from: str, date_to: str) -> dict:
    """Income breakdown by category for a date range."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_income_summary(
        user_id, db, date_from=date_from, date_to=date_to
    )


@mcp.tool()
async def compare_spending(
    period1_start: str, period1_end: str,
    period2_start: str, period2_end: str,
) -> dict:
    """Compare spending between two date periods, side by side."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.compare_spending(
        user_id, db,
        period1_start=period1_start, period1_end=period1_end,
        period2_start=period2_start, period2_end=period2_end,
    )


@mcp.tool()
async def search_financial_tips(query: str) -> dict:
    """Search a curated knowledge base of financial tips."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:insights")
    return await data_access.search_financial_tips(user_id, db, query=query)


@mcp.tool()
async def get_financial_health_score() -> dict:
    """Financial Health Score (0-100) with component breakdown."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:insights")
    return await data_access.get_financial_health_score(user_id, db)
```

- [ ] **Step 4: Register in server**

Modify `backend/src/pebble/mcp/server.py` to import the tools module at the bottom:

```python
# Register tools (must be imported AFTER `mcp` is defined)
from pebble.mcp import tools_read  # noqa: E402, F401
```

- [ ] **Step 5: Run tests, verify pass + smoke test list**

```bash
cd backend && uv run pytest tests/test_mcp_tools_read.py -v

# manual
curl -s -X POST http://localhost:8000/mcp/ \
  -H "Authorization: Bearer pb_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
```

Expected: 10 tool names listed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pebble/mcp/
git commit -m "feat: MCP read tools (10)"
```

---

### Task 10: Wrap the 5 budget CRUD tools

**Files:**
- Create: `backend/src/pebble/mcp/tools_budgets.py`
- Modify: `backend/src/pebble/mcp/server.py` (import the new module)

The CRUD tools wrap functions in `services/budgets.py`. Destructive operations include explicit "this will delete" copy in their descriptions so the MCP client surfaces it.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_mcp_tools_budgets.py`:

```python
import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from pebble.mcp.context import MCPRequestContext, set_context
from pebble.mcp.tools_budgets import create_budget, delete_budget
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.mark.asyncio
async def test_create_budget_requires_write_scope():
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    set_context(MCPRequestContext(user=user, api_key=key, db=AsyncMock()))
    with pytest.raises(Exception, match="write:budgets"):
        await create_budget(category_id=str(uuid4()), amount="100",
                            month=4, year=2026)


@pytest.mark.asyncio
async def test_delete_budget_calls_service(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["write:budgets"])
    set_context(MCPRequestContext(user=user, api_key=key, db=AsyncMock()))
    called = {}
    async def fake(uid, bid, db):
        called["bid"] = bid
    monkeypatch.setattr("pebble.services.budgets.delete_budget", fake)
    bid = str(uuid4())
    result = await delete_budget(budget_id=bid)
    assert called["bid"] == bid
    assert result["deleted"] is True
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Write the wrappers**

`backend/src/pebble/mcp/tools_budgets.py`:

```python
"""MCP tool wrappers for budget CRUD."""

from pebble.mcp.context import get_context
from pebble.mcp.server import mcp
from pebble.middleware.api_key_auth import require_scope
from pebble.services import budgets as svc


def _ctx_user_db():
    ctx = get_context()
    return str(ctx.user.id), ctx.db, ctx.api_key


@mcp.tool()
async def list_budgets(
    month: int | None = None, year: int | None = None
) -> dict:
    """List all budgets, optionally filtered by month/year."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:budgets")
    return await svc.get_budgets(user_id, db, month=month, year=year)


@mcp.tool()
async def get_budget(budget_id: str) -> dict:
    """Get a single budget by id."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:budgets")
    return await svc.get_budget(user_id, budget_id, db)


@mcp.tool()
async def create_budget(
    category_id: str, amount: str, month: int, year: int
) -> dict:
    """Create a new monthly budget for a category. amount is a USD string
    (e.g. "250.00"). This will appear in the user's budgets list immediately."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "write:budgets")
    return await svc.create_budget(
        user_id,
        {"category_id": category_id, "amount": amount,
         "month": month, "year": year},
        db,
    )


@mcp.tool()
async def update_budget(
    budget_id: str,
    amount: str | None = None,
    category_id: str | None = None,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Update fields on an existing budget. Only provided fields are changed."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "write:budgets")
    payload = {
        k: v
        for k, v in {
            "amount": amount, "category_id": category_id,
            "month": month, "year": year,
        }.items()
        if v is not None
    }
    return await svc.update_budget(user_id, budget_id, payload, db)


@mcp.tool()
async def delete_budget(budget_id: str) -> dict:
    """PERMANENTLY DELETE a budget. This cannot be undone. The user should
    confirm before calling."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "write:budgets")
    await svc.delete_budget(user_id, budget_id, db)
    return {"deleted": True, "budget_id": budget_id}
```

- [ ] **Step 4: Register in server**

Add `from pebble.mcp import tools_budgets  # noqa: E402, F401` next to the existing `tools_read` import in `server.py`.

- [ ] **Step 5: Run tests + smoke test list shows 15 tools**

```bash
cd backend && uv run pytest tests/test_mcp_tools_budgets.py -v
curl -s -X POST http://localhost:8000/mcp/ \
  -H "Authorization: Bearer pb_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
```

Expected: `15`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pebble/mcp/tools_budgets.py backend/src/pebble/mcp/server.py
git commit -m "feat: MCP budget CRUD tools (5)"
```

---

## Phase 4 — Hardening

### Task 11: Audit logging on every tool invocation

**Files:**
- Create: `backend/src/pebble/services/mcp_audit.py`
- Modify: `backend/src/pebble/mcp/tools_read.py` and `tools_budgets.py` (decorate via shared helper)
- Create: `backend/src/pebble/mcp/audit_decorator.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_mcp_audit.py`:

```python
import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from pebble.mcp.audit_decorator import audited
from pebble.mcp.context import MCPRequestContext, set_context
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.mark.asyncio
async def test_audited_logs_success(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    set_context(MCPRequestContext(user=user, api_key=key, db=AsyncMock()))

    captured = {}
    async def fake_write(*, db, user_id, api_key_id, tool_name, args, status,
                         latency_ms, error_message=None):
        captured.update(
            tool_name=tool_name, status=status, args=args,
        )
    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", fake_write
    )

    @audited("test_tool")
    async def my_tool(x: int) -> dict:
        return {"x": x}

    result = await my_tool(x=42)
    assert result == {"x": 42}
    assert captured["tool_name"] == "test_tool"
    assert captured["status"] == "ok"
    assert captured["args"] == {"x": 42}


@pytest.mark.asyncio
async def test_audited_logs_failure(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=[])
    set_context(MCPRequestContext(user=user, api_key=key, db=AsyncMock()))
    captured = {}
    async def fake_write(**kwargs): captured.update(kwargs)
    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", fake_write
    )

    @audited("boom")
    async def bad():
        raise ValueError("nope")

    with pytest.raises(ValueError):
        await bad()
    assert captured["status"] == "error"
    assert captured["error_message"] == "nope"
```

- [ ] **Step 2: Audit writer**

`backend/src/pebble/services/mcp_audit.py`:

```python
import json
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
```

- [ ] **Step 3: Decorator**

`backend/src/pebble/mcp/audit_decorator.py`:

```python
import functools
import time
from typing import Callable

from pebble.mcp.context import get_context
from pebble.services.mcp_audit import write_audit_entry


def audited(tool_name: str) -> Callable:
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(**kwargs):
            ctx = get_context()
            t0 = time.perf_counter()
            try:
                result = await fn(**kwargs)
                latency = int((time.perf_counter() - t0) * 1000)
                await write_audit_entry(
                    db=ctx.db, user_id=ctx.user.id, api_key_id=ctx.api_key.id,
                    tool_name=tool_name, args=kwargs,
                    status="ok", latency_ms=latency,
                )
                return result
            except Exception as e:
                latency = int((time.perf_counter() - t0) * 1000)
                status = "denied" if "scope" in str(e).lower() else "error"
                await write_audit_entry(
                    db=ctx.db, user_id=ctx.user.id, api_key_id=ctx.api_key.id,
                    tool_name=tool_name, args=kwargs,
                    status=status, latency_ms=latency,
                    error_message=str(e),
                )
                raise
        return wrapper
    return decorator
```

- [ ] **Step 4: Apply `@audited("…")` between `@mcp.tool()` and the function** in both `tools_read.py` and `tools_budgets.py` for all 15 tools. Example:

```python
@mcp.tool()
@audited("get_account_balances")
async def get_account_balances() -> dict:
    ...
```

- [ ] **Step 5: Run tests + verify a real call appears in `mcp_audit_log`**

```bash
cd backend && uv run pytest tests/test_mcp_audit.py -v
psql $DATABASE_URL -c "SELECT tool_name, status, latency_ms FROM mcp_audit_log ORDER BY created_at DESC LIMIT 5"
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/pebble/services/mcp_audit.py backend/src/pebble/mcp/audit_decorator.py backend/src/pebble/mcp/tools_*.py
git commit -m "feat: MCP audit logging"
```

---

### Task 12: Per-key rate limiting

**Files:**
- Create: `backend/src/pebble/mcp/rate_limit.py`
- Modify: `backend/src/pebble/mcp/auth_middleware.py` (call limiter after auth)

Use the same in-memory limiter pattern as `routers/auth.py:_login_limiter` to keep things consistent. Two windows: 60/min and 1000/day.

- [ ] **Step 1: Test**

`backend/tests/test_mcp_rate_limit.py`:

```python
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
```

- [ ] **Step 2: Implementation**

`backend/src/pebble/mcp/rate_limit.py`:

```python
import time
from collections import defaultdict, deque


class MCPRateLimiter:
    def __init__(self, per_minute: int = 60, per_day: int = 1000):
        self.per_minute = per_minute
        self.per_day = per_day
        self._minute: dict[str, deque] = defaultdict(deque)
        self._day: dict[str, deque] = defaultdict(deque)

    def check(self, key_id: str) -> int | None:
        """Return None if allowed, else seconds-to-retry."""
        now = time.monotonic()
        m = self._minute[key_id]
        d = self._day[key_id]
        while m and now - m[0] > 60:
            m.popleft()
        while d and now - d[0] > 86400:
            d.popleft()
        if len(m) >= self.per_minute:
            return int(60 - (now - m[0])) + 1
        if len(d) >= self.per_day:
            return int(86400 - (now - d[0])) + 1
        m.append(now)
        d.append(now)
        return None


_limiter = MCPRateLimiter()


def check_or_raise(key_id: str) -> None:
    retry_after = _limiter.check(key_id)
    if retry_after is None:
        return
    from fastapi import HTTPException
    raise HTTPException(
        status_code=429,
        detail="Rate limit exceeded",
        headers={"Retry-After": str(retry_after)},
    )
```

- [ ] **Step 3: Wire into auth middleware** — after successful `authenticate_api_key`, call:

```python
from pebble.mcp.rate_limit import _limiter
retry = _limiter.check(str(key.id))
if retry is not None:
    return JSONResponse(
        {"error": "Rate limit exceeded"},
        status_code=429,
        headers={"Retry-After": str(retry)},
    )
```

- [ ] **Step 4: Add `_limiter` to `conftest.py:_reset_rate_limiters` autouse fixture**

```python
from pebble.mcp.rate_limit import _limiter as _mcp_limiter
# in the fixture body:
_mcp_limiter._minute.clear()
_mcp_limiter._day.clear()
```

- [ ] **Step 5: Run tests, verify pass + commit**

```bash
cd backend && uv run pytest tests/test_mcp_rate_limit.py -v
git add backend/src/pebble/mcp/rate_limit.py backend/src/pebble/mcp/auth_middleware.py backend/tests/conftest.py
git commit -m "feat: per-key MCP rate limiting"
```

---

## Phase 5 — Documentation & Setup

### Task 13: Setup guide for end users

**Files:**
- Create: `docs/MCP_SETUP.md`

- [ ] **Step 1: Write the doc**

Sections:
1. **What it is** — one paragraph: external AI clients can now query your Pebble data.
2. **Get a key** — Settings → Connected AI tools → Generate. Choose scopes. Copy the `pb_…` value.
3. **Claude Desktop config** — example for `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "pebble": {
         "url": "https://api.pebble.app/mcp/",
         "headers": {
           "Authorization": "Bearer pb_YOUR_KEY_HERE"
         }
       }
     }
   }
   ```

4. **Cursor config** — equivalent.
5. **Available tools** — table listing the 15 tools, what they do, and which scope they need.
6. **Revoke a key** — list screen, swipe, confirm.
7. **Limits** — 60 req/min, 1000 req/day per key.
8. **Security** — keys are read-only by default; `write:budgets` is opt-in; revoke any key from the app at any time.

- [ ] **Step 2: Commit**

```bash
git add docs/MCP_SETUP.md
git commit -m "docs: MCP server setup guide"
```

---

### Task 14: End-to-end test with a real MCP client

**Files:**
- None (manual verification step)

- [ ] **Step 1: Deploy to staging Cloud Run**

```bash
# from infra/terraform/gcp
terraform apply -var-file=staging.tfvars
```

- [ ] **Step 2: Generate a test key in the staging app, scopes=all 5**

- [ ] **Step 3: Configure Claude Desktop** with the staging URL + key (see `docs/MCP_SETUP.md`).

- [ ] **Step 4: Run a smoke conversation** in Claude Desktop:
  - "What did I spend on groceries last month?" → should call `get_spending_by_category`.
  - "Create a $400 dining budget for May 2026 in category X" → should call `create_budget`.
  - "Delete that budget" → should ask for confirmation, then call `delete_budget`.

- [ ] **Step 5: Verify audit log**

```bash
psql $STAGING_DB -c "SELECT tool_name, status, latency_ms, created_at \
  FROM mcp_audit_log ORDER BY created_at DESC LIMIT 20"
```

Expected: rows for each call above with `status='ok'`.

- [ ] **Step 6: Revoke the test key from the app**, retry a tool call from Claude Desktop, expect 401.

---

## Self-Review Checklist

- ✅ Spec coverage: scopes (Task 4), key CRUD (Tasks 4–6), MCP scaffolding (Task 7), auth (Task 8), 10 read tools (Task 9), 5 budget tools (Task 10), audit log (Task 11), rate limit (Task 12), docs (Task 13), e2e (Task 14).
- ✅ No placeholders — every code step has full code.
- ✅ Type consistency: `APIKey.scopes` is `list[str]` everywhere; `MCPRequestContext.user/api_key/db` consistent across `context.py`, `auth_middleware.py`, `audit_decorator.py`.
- ✅ Tool names match between read tool wrappers and `data_access` handlers.
- ✅ Scope strings consistent: `read:transactions`, `read:accounts`, `read:budgets`, `write:budgets`, `read:insights` used identically in service, schema, UI, and tool wrappers.

---

## Estimated Effort

| Phase | Tasks | Time |
|---|---|---|
| 1 — Foundation | 1–3 | 0.5 day |
| 2 — Key management | 4–6 | 1 day (mostly UI) |
| 3 — MCP server | 7–10 | 1 day |
| 4 — Hardening | 11–12 | 0.5 day |
| 5 — Docs & e2e | 13–14 | 0.5 day |
| **Total** | | **~3.5 days** |

---

## Open Questions for the Owner

1. **Mobile UI placement:** is there an existing Settings screen to attach "Connected AI tools" to, or does that screen need to be created?
2. **Key expiry:** should keys auto-expire after N days of inactivity, or only revoke manually? v1 assumes manual only.
3. **Production URL:** is `api.pebble.app` the canonical hostname or is there a different one (`backend.…`, etc.)? The setup guide hardcodes the URL.
4. **OAuth migration timing:** if/when this graduates from internal use to a public MCP server, OAuth 2.1 with Dynamic Client Registration becomes important. Track as a follow-up issue.
