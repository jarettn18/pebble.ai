from pydantic import BaseModel


class AllocationIn(BaseModel):
    category_id: str
    amount: str


class AllocationOut(BaseModel):
    id: str
    category_id: str
    category_name: str | None = None
    category_color: str | None = None
    amount: str

    model_config = {"from_attributes": True}


class MonthYear(BaseModel):
    month: int
    year: int


class BudgetPlanCreateRequest(BaseModel):
    name: str | None = None
    total_amount: str
    allocations: list[AllocationIn]
    months: list[MonthYear] = []
    is_recurring: bool = False


class BudgetPlanUpdateRequest(BaseModel):
    name: str | None = None
    total_amount: str | None = None
    allocations: list[AllocationIn] | None = None
    recurring_active: bool | None = None


class BudgetPlanOut(BaseModel):
    id: str
    name: str | None = None
    total_amount: str
    is_recurring: bool
    recurring_start_month: int | None = None
    recurring_start_year: int | None = None
    recurring_active: bool
    allocations: list[AllocationOut] = []
    created_at: str

    model_config = {"from_attributes": True}


class BudgetPlanListResponse(BaseModel):
    budget_plans: list[BudgetPlanOut]
