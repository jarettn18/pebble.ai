import enum
import uuid

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class SubscriptionTier(str, enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier), default=SubscriptionTier.free
    )
    api_key_hash: Mapped[str | None] = mapped_column(String(64), unique=True)

    plaid_items: Mapped[list["PlaidItem"]] = relationship(back_populates="user")  # noqa: F821
    accounts: Mapped[list["Account"]] = relationship(back_populates="user")  # noqa: F821
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")  # noqa: F821
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user")  # noqa: F821
    conversations: Mapped[list["ChatConversation"]] = relationship(back_populates="user")  # noqa: F821
    assets: Mapped[list["Asset"]] = relationship(back_populates="user")  # noqa: F821
    budget_plans: Mapped[list["BudgetPlan"]] = relationship(back_populates="user")  # noqa: F821
