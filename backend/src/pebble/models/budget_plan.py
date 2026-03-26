import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class BudgetPlan(Base, TimestampMixin):
    __tablename__ = "budget_plans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_start_month: Mapped[int | None] = mapped_column(Integer)
    recurring_start_year: Mapped[int | None] = mapped_column(Integer)
    recurring_active: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="budget_plans")  # noqa: F821
    allocations: Mapped[list["BudgetPlanAllocation"]] = relationship(
        back_populates="budget_plan", cascade="all, delete-orphan"
    )
    budgets: Mapped[list["Budget"]] = relationship(back_populates="budget_plan")  # noqa: F821


class BudgetPlanAllocation(Base):
    __tablename__ = "budget_plan_allocations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    budget_plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("budget_plans.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))

    budget_plan: Mapped["BudgetPlan"] = relationship(back_populates="allocations")
    category: Mapped["Category"] = relationship()  # noqa: F821
