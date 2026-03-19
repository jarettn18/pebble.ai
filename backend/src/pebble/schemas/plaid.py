from pydantic import BaseModel


class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str


class ExchangeTokenRequest(BaseModel):
    public_token: str
    institution_id: str | None = None
    institution_name: str | None = None


class ExchangeTokenResponse(BaseModel):
    item_id: str
    accounts_linked: int


class SyncRequest(BaseModel):
    item_id: str


class SyncResponse(BaseModel):
    added: int
    modified: int
    removed: int
