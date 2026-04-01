import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from pebble.models.base import Base, TimestampMixin, gen_uuid


class FinancialTip(Base, TimestampMixin):
    __tablename__ = "financial_tips"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100))  # budgeting, saving, debt, etc.
    embedding = mapped_column(Vector(384))
