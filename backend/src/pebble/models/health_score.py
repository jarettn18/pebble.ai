import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class FinancialHealthScore(Base, TimestampMixin):
    __tablename__ = "financial_health_scores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    overall_score: Mapped[int] = mapped_column(Integer)
    grade: Mapped[str] = mapped_column(String(2))
    savings_rate_score: Mapped[int] = mapped_column(Integer)
    debt_to_income_score: Mapped[int] = mapped_column(Integer)
    emergency_fund_score: Mapped[int] = mapped_column(Integer)
    budget_adherence_score: Mapped[int] = mapped_column(Integer)
    net_worth_trend_score: Mapped[int] = mapped_column(Integer)
    diversification_score: Mapped[int] = mapped_column(Integer)
    credit_score_component: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_completeness: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    component_details: Mapped[dict] = mapped_column(JSON, default=dict)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821
