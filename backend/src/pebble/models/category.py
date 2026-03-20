import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from pebble.models.base import Base, gen_uuid


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    plaid_primary: Mapped[str | None] = mapped_column(String(50), unique=True)
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(7))  # hex color
