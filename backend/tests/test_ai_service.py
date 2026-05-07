"""Tests for pebble.ai.service (LiteLLM-based rewrite)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from pebble.ai.service import AIChatService


# ---------------------------------------------------------------------------
# Fake chunk helpers
# ---------------------------------------------------------------------------


class FakeFnDelta:
    def __init__(self, name=None, arguments=None):
        self.name = name
        self.arguments = arguments


class FakeToolCallDelta:
    def __init__(self, index, id=None, name=None, arguments=None):
        self.index = index
        self.id = id
        self.function = FakeFnDelta(name=name, arguments=arguments) if (name or arguments) else None


class FakeDelta:
    def __init__(self, content=None, tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls


class FakeChoice:
    def __init__(self, delta=None, finish_reason=None):
        self.delta = delta
        self.finish_reason = finish_reason


class FakeChunk:
    def __init__(self, choices, usage=None):
        self.choices = choices
        self.usage = usage


class FakeUsage:
    def __init__(self, prompt_tokens=0, completion_tokens=0):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens


async def _aiter(items):
    for i in items:
        yield i


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unknown_model_yields_error_event():
    svc = AIChatService()
    out = []
    async for ev in svc.stream_chat(
        user_id="u1",
        conversation_id=None,
        message="hi",
        db=AsyncMock(),
        model_key="bogus",
    ):
        out.append(ev)
    assert any('"type": "error"' in e and "Unknown model" in e for e in out)


@pytest.mark.asyncio
async def test_text_only_response_streams_deltas_and_emits_done(monkeypatch):
    chunks = [
        FakeChunk([FakeChoice(delta=FakeDelta(content="Hello"))]),
        FakeChunk(
            [FakeChoice(delta=FakeDelta(content=" world"), finish_reason="stop")],
            usage=FakeUsage(prompt_tokens=10, completion_tokens=2),
        ),
    ]

    async def fake_acompletion(**_kwargs):
        return _aiter(chunks)

    import litellm as _litellm
    monkeypatch.setattr(_litellm, "acompletion", fake_acompletion)

    async def fake_profile(*_a, **_k):
        return "fake-profile"

    monkeypatch.setattr("pebble.ai.service.build_financial_profile", fake_profile)

    fake_conv = MagicMock(id=uuid.uuid4())

    async def fake_conv_helper(*_a, **_kw):
        return fake_conv

    monkeypatch.setattr(AIChatService, "_get_or_create_conversation", fake_conv_helper)
    monkeypatch.setattr(AIChatService, "_load_history", AsyncMock(return_value=[]))
    monkeypatch.setattr(AIChatService, "_save_message", AsyncMock(return_value=None))
    monkeypatch.setattr(AIChatService, "_track_usage", AsyncMock(return_value=None))
    monkeypatch.setattr(AIChatService, "_auto_title", AsyncMock(return_value=None))

    svc = AIChatService()
    out = []
    async for ev in svc.stream_chat(
        user_id="u1",
        conversation_id=None,
        message="hello",
        db=AsyncMock(),
    ):
        out.append(ev)

    assert any('"content": "Hello"' in e for e in out)
    assert any('"content": " world"' in e for e in out)
    assert any('"type": "done"' in e for e in out)
    # Verify conv_id appears in the done event
    done_events = [e for e in out if '"type": "done"' in e]
    assert len(done_events) == 1
    assert str(fake_conv.id) in done_events[0]


@pytest.mark.asyncio
async def test_tool_call_round_executes_handler_and_loops(monkeypatch):
    call_count = {"n": 0}
    acompletion_calls = {"n": 0}

    async def fake_acompletion(**_kwargs):
        call_count["n"] += 1
        acompletion_calls["n"] += 1
        if call_count["n"] == 1:
            return _aiter([
                FakeChunk([FakeChoice(delta=FakeDelta(tool_calls=[
                    FakeToolCallDelta(index=0, id="tc1", name="get_account_balances")
                ]))]),
                FakeChunk([FakeChoice(
                    delta=FakeDelta(tool_calls=[
                        FakeToolCallDelta(index=0, arguments="{}")
                    ]),
                    finish_reason="tool_calls",
                )]),
            ])
        return _aiter([
            FakeChunk([FakeChoice(delta=FakeDelta(content="$1234"), finish_reason="stop")]),
        ])

    import litellm as _litellm
    monkeypatch.setattr(_litellm, "acompletion", fake_acompletion)

    async def fake_profile(*_a, **_k):
        return "fake-profile"

    monkeypatch.setattr("pebble.ai.service.build_financial_profile", fake_profile)

    fake_conv = MagicMock(id=uuid.uuid4())

    async def fake_conv_helper(*_a, **_kw):
        return fake_conv

    monkeypatch.setattr(AIChatService, "_get_or_create_conversation", fake_conv_helper)
    monkeypatch.setattr(AIChatService, "_load_history", AsyncMock(return_value=[]))
    monkeypatch.setattr(AIChatService, "_save_message", AsyncMock(return_value=None))
    monkeypatch.setattr(AIChatService, "_track_usage", AsyncMock(return_value=None))
    monkeypatch.setattr(AIChatService, "_auto_title", AsyncMock(return_value=None))

    # Stub the tool handler
    async def fake_handler(*_a, **_k):
        return {"total": 1234}

    import pebble.ai.service as svc_mod
    monkeypatch.setitem(svc_mod.TOOL_HANDLERS, "get_account_balances", fake_handler)

    svc = AIChatService()
    out = []
    async for ev in svc.stream_chat(
        user_id="u1",
        conversation_id=None,
        message="what are my balances?",
        db=AsyncMock(),
    ):
        out.append(ev)

    # Should emit a tool_call event with name get_account_balances
    tool_call_events = [e for e in out if '"type": "tool_call"' in e]
    assert len(tool_call_events) == 1
    assert '"get_account_balances"' in tool_call_events[0]

    # Should emit delta with $1234
    assert any('"$1234"' in e for e in out)

    # Should emit done
    assert any('"type": "done"' in e for e in out)

    # litellm.acompletion called exactly twice
    assert acompletion_calls["n"] == 2
