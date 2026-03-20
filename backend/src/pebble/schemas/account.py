from pydantic import BaseModel


class AccountOut(BaseModel):
    id: str
    name: str
    official_name: str | None = None
    type: str
    subtype: str | None = None
    balance_current: str | None = None
    balance_available: str | None = None
    iso_currency_code: str | None = None
    institution_name: str | None = None

    model_config = {"from_attributes": True}


class AccountListResponse(BaseModel):
    accounts: list[AccountOut]
