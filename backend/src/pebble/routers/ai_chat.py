import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.ai.models import ALLOWED_MODELS, DEFAULT_MODEL_KEY
from pebble.ai.service import AIChatService
from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.chat import ChatConversation, ChatMessage
from pebble.models.user import User
from pebble.schemas.ai_chat import (
    ChatRequest,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationOut,
    MessageOut,
    ModelOption,
    ModelsResponse,
)
from pebble.services.rate_limiter import RateLimitDependency

router = APIRouter(prefix="/v1/ai", tags=["ai-chat"])

_service = AIChatService()
_chat_limiter = RateLimitDependency(max_requests=10, window_seconds=60)


@router.post("/chat", dependencies=[Depends(_chat_limiter)])
async def chat(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty"
        )

    async def _generate():
        async for chunk in _service.stream_chat(
            str(user.id),
            req.conversation_id,
            req.message.strip(),
            db,
            model_key=req.model,
        ):
            yield chunk
        await db.commit()

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/models", response_model=ModelsResponse)
async def list_models(user: User = Depends(get_current_user)):
    return ModelsResponse(
        models=[
            ModelOption(key=k, label=v["label"], tier=v["tier"])
            for k, v in ALLOWED_MODELS.items()
        ],
        default=DEFAULT_MODEL_KEY,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatConversation)
        .where(ChatConversation.user_id == user.id)
        .options(joinedload(ChatConversation.messages))
        .order_by(ChatConversation.created_at.desc())
    )
    convos = result.scalars().unique().all()

    return ConversationListResponse(
        conversations=[
            ConversationOut(
                id=str(c.id),
                title=c.title,
                created_at=c.created_at.isoformat(),
                last_message_preview=(
                    c.messages[-1].content[:80] if c.messages else None
                ),
            )
            for c in convos
        ]
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(
        select(ChatConversation)
        .where(ChatConversation.id == conv_uuid, ChatConversation.user_id == user.id)
        .options(joinedload(ChatConversation.messages))
    )
    conv = result.scalars().unique().one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return ConversationDetailResponse(
        id=str(conv.id),
        title=conv.title,
        messages=[
            MessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
                model=m.model,
            )
            for m in conv.messages
        ],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(
        select(ChatConversation).where(
            ChatConversation.id == conv_uuid, ChatConversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    # Delete messages first (no cascade configured on FK)
    msgs = await db.execute(
        select(ChatMessage).where(ChatMessage.conversation_id == conv.id)
    )
    for m in msgs.scalars().all():
        await db.delete(m)
    await db.delete(conv)
    await db.commit()
