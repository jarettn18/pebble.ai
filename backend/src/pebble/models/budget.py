import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class Budget(Base, TimestampMixin):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    month: Mapped[int] = mapped_column(Integer)  # YYYYMM format, e.g. 202603
    year: Mapped[int] = mapped_column(Integer)
    budget_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("budget_plans.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="budgets")  # noqa: F821
    category: Mapped["Category"] = relationship()  # noqa: F821
    budget_plan: Mapped["BudgetPlan | None"] = relationship(back_populates="budgets")  # noqa: F821
