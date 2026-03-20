from pydantic import BaseModel


class BudgetOut(BaseModel):
    id: str
    category_id: str
    category_name: str | None = None
    amount: str
    spent: str
    month: int
    year: int

    model_config = {"from_attributes": True}


class BudgetCreateRequest(BaseModel):
    category_id: str
    amount: str
    month: int
    year: int


class BudgetUpdateRequest(BaseModel):
    category_id: str | None = None
    amount: str | None = None
    month: int | None = None
    year: int | None = None


class BudgetListResponse(BaseModel):
    budgets: list[BudgetOut]
