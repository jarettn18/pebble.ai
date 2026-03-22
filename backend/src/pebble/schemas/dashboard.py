from pydantic import BaseModel


class AccountSummary(BaseModel):
    id: str
    name: str
    type: str
    subtype: str | None = None
    balance_current: str | None = None
    institution_name: str | None = None


class BudgetSummary(BaseModel):
    category_name: str | None = None
    amount: str
    spent: str


class SpendingByCategory(BaseModel):
    category_name: str
    amount: str


class MonthlySpendingPoint(BaseModel):
    month: int
    year: int
    label: str
    amount: str


class NetWorthPoint(BaseModel):
    date: str
    value: str


class NetWorthHistoryResponse(BaseModel):
    period: str
    points: list[NetWorthPoint]
    current: str | None = None
    change: str | None = None
    change_pct: str | None = None


class IncomeByCategory(BaseModel):
    category_name: str
    amount: str


class AssetSummary(BaseModel):
    id: str
    name: str
    asset_type: str
    estimated_value: str


class DashboardResponse(BaseModel):
    net_worth: str | None = None
    monthly_spending: str
    monthly_income: str
    accounts: list[AccountSummary]
    assets: list[AssetSummary] = []
    budget_summaries: list[BudgetSummary]
    spending_by_category: list[SpendingByCategory]
    income_by_category: list[IncomeByCategory]
    spending_over_time: list[MonthlySpendingPoint]
    income_over_time: list[MonthlySpendingPoint]
