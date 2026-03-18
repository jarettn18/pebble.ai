import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from pebble.models.base import Base, TimestampMixin, gen_uuid


class ApiUsage(Base, TimestampMixin):
    __tablename__ = "api_usage"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    billing_period: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
