from pydantic import BaseModel


class AssetOut(BaseModel):
    id: str
    name: str
    asset_type: str
    estimated_value: str
    address: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class AssetCreateRequest(BaseModel):
    name: str
    asset_type: str
    estimated_value: str
    address: str | None = None
    notes: str | None = None


class AssetUpdateRequest(BaseModel):
    name: str | None = None
    asset_type: str | None = None
    estimated_value: str | None = None
    address: str | None = None
    notes: str | None = None


class AssetListResponse(BaseModel):
    assets: list[AssetOut]
