import re

from pydantic import BaseModel, field_validator


class CategoryOut(BaseModel):
    id: str
    name: str
    icon: str | None = None
    color: str | None = None

    model_config = {"from_attributes": True}


class CategoryListResponse(BaseModel):
    categories: list[CategoryOut]


class CategoryUpdateRequest(BaseModel):
    color: str

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("color must be a valid hex color (e.g. #4CAF50)")
        return v.upper()
