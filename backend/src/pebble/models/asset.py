import enum
import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class AssetType(str, enum.Enum):
    primary_residence = "primary_residence"
    rental = "rental"
    investment_property = "investment_property"
    vacation = "vacation"
    land = "land"
    car = "car"
    motorcycle = "motorcycle"
    boat = "boat"
    other = "other"


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType))
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    address: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="assets")  # noqa: F821
