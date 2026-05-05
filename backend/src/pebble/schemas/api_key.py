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

    model_config = {"from_attributes": True}


class APIKeyCreateResponse(BaseModel):
    api_key: APIKeyOut
    raw_key: str  # shown once at creation, never again
