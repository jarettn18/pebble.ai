from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ConversationOut(BaseModel):
    id: str
    title: str | None
    created_at: str
    last_message_preview: str | None = None


class ConversationListResponse(BaseModel):
    conversations: list[ConversationOut]


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationDetailResponse(BaseModel):
    id: str
    title: str | None
    messages: list[MessageOut]
