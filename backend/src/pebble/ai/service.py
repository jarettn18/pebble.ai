"""AI chat service — orchestrates Claude tool-use conversations with SSE streaming."""

import json
import logging
import uuid
from datetime import date
from typing import AsyncGenerator

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.ai.profile import build_financial_profile
from pebble.ai.prompts import SYSTEM_PROMPT
from pebble.ai.tools import TOOL_DEFINITIONS, TOOL_HANDLERS
from pebble.config import settings
from pebble.models.api_usage import ApiUsage
from pebble.models.chat import ChatConversation, ChatMessage

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 3
HISTORY_LIMIT = 20  # sliding window of messages to include as context


def _sse(event_type: str, **kwargs) -> str:
    payload = {"type": event_type, **kwargs}
    return f"data: {json.dumps(payload)}\n\n"


class AIChatService:
    def __init__(self) -> None:
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def stream_chat(
        self,
        user_id: str,
        conversation_id: str | None,
        message: str,
        db: AsyncSession,
    ) -> AsyncGenerator[str, None]:
        try:
            # 1. Get or create conversation
            conversation = await self._get_or_create_conversation(
                user_id, conversation_id, db
            )
            conv_id = str(conversation.id)

            # 2. Load message history (sliding window)
            history = await self._load_history(conversation.id, db)

            # 3. Build financial profile and system prompt
            financial_profile = await build_financial_profile(user_id, db)
            system_prompt = SYSTEM_PROMPT.format(
                current_date=date.today().isoformat(),
                financial_profile=financial_profile,
            )

            # 4. Build messages for Claude
            messages = history + [{"role": "user", "content": message}]

            # 5. Tool execution loop
            total_input_tokens = 0
            total_output_tokens = 0
            assistant_text = ""

            for _round in range(MAX_TOOL_ROUNDS):
                response = await self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                    max_tokens=1024,
                )
                total_input_tokens += response.usage.input_tokens
                total_output_tokens += response.usage.output_tokens

                if response.stop_reason == "tool_use":
                    # Execute tool calls
                    tool_results = []
                    for block in response.content:
                        if block.type == "tool_use":
                            yield _sse("tool_call", tool=block.name)
                            result = await self._execute_tool(
                                block.name, block.input, user_id, db
                            )
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": json.dumps(result),
                            })

                    # Append assistant response + tool results for next round
                    messages.append({"role": "assistant", "content": response.content})
                    messages.append({"role": "user", "content": tool_results})
                else:
                    # Final text response — extract and stream it
                    for block in response.content:
                        if hasattr(block, "text"):
                            assistant_text += block.text
                    break

            # 6. Stream the final response in chunks for smooth UI
            chunk_size = 20
            for i in range(0, len(assistant_text), chunk_size):
                yield _sse("delta", content=assistant_text[i : i + chunk_size])

            # 7. Persist messages
            await self._save_message(conversation.id, "user", message, db)
            await self._save_message(conversation.id, "assistant", assistant_text, db)

            # 8. Auto-title on first exchange
            is_first = len(history) == 0
            if is_first and assistant_text:
                await self._auto_title(conversation, message, db)

            # 9. Track usage
            await self._track_usage(
                user_id, total_input_tokens + total_output_tokens, db
            )

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
        db: AsyncSession,
    ) -> None:
        msg = ChatMessage(
            conversation_id=conversation_id, role=role, content=content,
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
        self, conversation: ChatConversation, first_message: str, db: AsyncSession,
    ) -> None:
        try:
            resp = await self.client.messages.create(
                model=self.model,
                messages=[{
                    "role": "user",
                    "content": f"Generate a short title (5 words max) for a conversation that starts with: \"{first_message}\". Reply with ONLY the title, no quotes.",
                }],
                max_tokens=30,
            )
            title = resp.content[0].text.strip()[:255]
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
                ApiUsage.user_id == user_id,
                ApiUsage.billing_period == period,
            )
        )
        usage = result.scalar_one_or_none()
        if usage:
            usage.request_count += 1
            usage.token_count += token_count
        else:
            usage = ApiUsage(
                user_id=user_id,
                billing_period=period,
                request_count=1,
                token_count=token_count,
            )
            db.add(usage)
        await db.flush()
