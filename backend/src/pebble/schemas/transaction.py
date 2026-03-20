from pydantic import BaseModel


class TransactionOut(BaseModel):
    id: str
    account_id: str
    amount: str
    date: str
    name: str
    merchant_name: str | None = None
    pending: bool
    category_name: str | None = None

    model_config = {"from_attributes": True}


class TransactionDetailOut(TransactionOut):
    category_id: str | None = None
    notes: str | None = None


class TransactionUpdateRequest(BaseModel):
    category_id: str | None = None
    notes: str | None = None


class TransactionListResponse(BaseModel):
    transactions: list[TransactionOut]
    count: int
