from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: str
    name: str
    icon: str | None = None
    color: str | None = None

    model_config = {"from_attributes": True}


class CategoryListResponse(BaseModel):
    categories: list[CategoryOut]
