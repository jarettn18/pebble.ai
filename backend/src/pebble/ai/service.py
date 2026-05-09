"""AI chat service — orchestrates multi-provider tool-use conversations via LiteLLM."""

import json
import logging
import uuid
from datetime import date
from typing import AsyncGenerator

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.ai.models import resolve_model
from pebble.ai.profile import build_financial_profile
from pebble.ai.prompts import SYSTEM_PROMPT
from pebble.ai.tools import TOOL_DEFINITIONS, TOOL_HANDLERS
from pebble.config import settings
from pebble.models.api_usage import ApiUsage
from pebble.models.chat import ChatConversation, ChatMessage

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 3
HISTORY_LIMIT = 20


def _sse(event_type: str, **kwargs) -> str:
    payload = {"type": event_type, **kwargs}
    return f"data: {json.dumps(payload)}\n\n"


def _provider_kwargs(litellm_id: str) -> dict:
    """Return per-provider kwargs (api_key) for LiteLLM."""
    if litellm_id.startswith("anthropic/"):
        return {"api_key": settings.anthropic_api_key} if settings.anthropic_api_key else {}
    if litellm_id.startswith("openai/"):
        return {"api_key": settings.openai_api_key} if settings.openai_api_key else {}
    if litellm_id.startswith("gemini/"):
        return {"api_key": settings.gemini_api_key} if settings.gemini_api_key else {}
    return {}


class AIChatService:
    async def stream_chat(
        self,
        user_id: str,
        conversation_id: str | None,
        message: str,
        db: AsyncSession,
        model_key: str | None = None,
    ) -> AsyncGenerator[str, None]:
        try:
            entry = resolve_model(model_key)
        except ValueError as e:
            yield _sse("error", message=str(e))
            return

        litellm_id = entry["litellm_id"]
        provider_kwargs = _provider_kwargs(litellm_id)

        try:
            conversation = await self._get_or_create_conversation(user_id, conversation_id, db)
            conv_id = str(conversation.id)
            history = await self._load_history(conversation.id, db)
            financial_profile = await build_financial_profile(user_id, db)
            system_prompt = SYSTEM_PROMPT.format(
                current_date=date.today().isoformat(),
                financial_profile=financial_profile,
            )

            # OpenAI-shape: system is a message at index 0
            messages: list[dict] = [{"role": "system", "content": system_prompt}]
            messages.extend(history)
            messages.append({"role": "user", "content": message})

            total_input_tokens = 0
            total_output_tokens = 0
            assistant_text = ""

            for _round in range(MAX_TOOL_ROUNDS):
                stream = await litellm.acompletion(
                    model=litellm_id,
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                    stream=True,
                    max_tokens=1024,
                    **provider_kwargs,
                )

                tool_calls_acc: dict[int, dict] = {}
                emitted_tool_indices: set[int] = set()
                content_acc = ""
                finish_reason: str | None = None
                usage = None

                async for chunk in stream:
                    choice = chunk.choices[0]
                    delta = choice.delta

                    if getattr(delta, "content", None):
                        content_acc += delta.content
                        yield _sse("delta", content=delta.content)

                    if getattr(delta, "tool_calls", None):
                        for tc in delta.tool_calls:
                            slot = tool_calls_acc.setdefault(
                                tc.index, {"id": "", "name": "", "arguments": ""}
                            )
                            if tc.id:
                                slot["id"] = tc.id
                            fn = getattr(tc, "function", None)
                            if fn and fn.name:
                                slot["name"] = fn.name
                                # First time we see the name → emit tool_call SSE
                                if tc.index not in emitted_tool_indices:
                                    yield _sse("tool_call", tool=fn.name)
                                    emitted_tool_indices.add(tc.index)
                            if fn and fn.arguments:
                                slot["arguments"] += fn.arguments

                    if choice.finish_reason:
                        finish_reason = choice.finish_reason

                    # LiteLLM attaches usage to the final chunk on most providers
                    if getattr(chunk, "usage", None):
                        usage = chunk.usage

                if usage:
                    total_input_tokens += getattr(usage, "prompt_tokens", 0) or 0
                    total_output_tokens += getattr(usage, "completion_tokens", 0) or 0

                if finish_reason == "tool_calls" and tool_calls_acc:
                    assistant_msg = {
                        "role": "assistant",
                        "content": content_acc or None,
                        "tool_calls": [
                            {
                                "id": c["id"],
                                "type": "function",
                                "function": {"name": c["name"], "arguments": c["arguments"]},
                            }
                            for c in tool_calls_acc.values()
                        ],
                    }
                    messages.append(assistant_msg)

                    for c in tool_calls_acc.values():
                        try:
                            args = json.loads(c["arguments"]) if c["arguments"] else {}
                        except json.JSONDecodeError:
                            args = {}
                            logger.warning("Tool %s got malformed JSON args", c["name"])
                        result = await self._execute_tool(c["name"], args, user_id, db)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": c["id"],
                            "content": json.dumps(result),
                        })
                    continue

                # Final text response
                assistant_text = content_acc
                break

            if not assistant_text:
                yield _sse("error", message="Model did not produce a response after tool calls")
                return

            await self._save_message(conversation.id, "user", message, model_key=None, db=db)
            await self._save_message(
                conversation.id, "assistant", assistant_text,
                model_key=litellm_id, db=db,
            )

            if len(history) == 0:
                await self._auto_title(conversation, message, litellm_id, provider_kwargs, db)

            await self._track_usage(user_id, total_input_tokens + total_output_tokens, db)

            yield _sse("done", conversation_id=conv_id)

        except Exception as e:
            logger.exception("AI chat error")
            yield _sse("error", message=str(e))

    async def _get_or_create_conversation(
        self, user_id: str, conversation_id: str | None, db: AsyncSession,
    ) -> ChatConversation:
        if conversation_id:
            result = await db.execute(
                select(ChatConversation).where(
                    ChatConversation.id == uuid.UUID(conversation_id),
                    ChatConversation.user_id == user_id,
                )
            )
            conv = result.scalar_one_or_none()
            if conv:
                return conv
        conv = ChatConversation(user_id=user_id, title=None)
        db.add(conv)
        await db.flush()
        return conv

    async def _load_history(
        self, conversation_id: uuid.UUID, db: AsyncSession,
    ) -> list[dict]:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
        rows = list(reversed(result.scalars().all()))
        return [{"role": m.role, "content": m.content} for m in rows]

    async def _save_message(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        model_key: str | None,
        db: AsyncSession,
    ) -> None:
        msg = ChatMessage(
            conversation_id=conversation_id, role=role, content=content, model=model_key,
        )
        db.add(msg)
        await db.flush()

    async def _execute_tool(
        self, tool_name: str, tool_input: dict, user_id: str, db: AsyncSession,
    ) -> dict:
        handler = TOOL_HANDLERS.get(tool_name)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        try:
            return await handler(user_id, db, **tool_input)
        except Exception as e:
            logger.warning("Tool %s failed: %s", tool_name, e)
            return {"error": f"Could not retrieve data: {e}"}

    async def _auto_title(
        self,
        conversation: ChatConversation,
        first_message: str,
        litellm_id: str,
        provider_kwargs: dict,
        db: AsyncSession,
    ) -> None:
        try:
            resp = await litellm.acompletion(
                model=litellm_id,
                messages=[{
                    "role": "user",
                    "content": (
                        f'Generate a short title (5 words max) for a conversation that '
                        f'starts with: "{first_message}". Reply with ONLY the title, no quotes.'
                    ),
                }],
                max_tokens=30,
                **provider_kwargs,
            )
            title = resp.choices[0].message.content.strip()[:255]
            conversation.title = title
            await db.flush()
        except Exception:
            logger.warning("Auto-title generation failed", exc_info=True)

    async def _track_usage(
        self, user_id: str, token_count: int, db: AsyncSession,
    ) -> None:
        period = date.today().strftime("%Y-%m")
        result = await db.execute(
            select(ApiUsage).where(
                ApiUsage.user_id == user_id, ApiUsage.billing_period == period,
            )
        )
        usage = result.scalar_one_or_none()
        if usage:
            usage.request_count += 1
            usage.token_count += token_count
        else:
            usage = ApiUsage(
                user_id=user_id, billing_period=period,
                request_count=1, token_count=token_count,
            )
            db.add(usage)
        await db.flush()
