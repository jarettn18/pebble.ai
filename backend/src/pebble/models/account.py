import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pebble.models.base import Base, TimestampMixin, gen_uuid


class PlaidItem(Base, TimestampMixin):
    __tablename__ = "plaid_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    plaid_item_id: Mapped[str] = mapped_column(String(255), unique=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text)
    institution_id: Mapped[str | None] = mapped_column(String(255))
    institution_name: Mapped[str | None] = mapped_column(String(255))
    cursor: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="plaid_items")  # noqa: F821
    accounts: Mapped[list["Account"]] = relationship(back_populates="plaid_item")


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=gen_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    plaid_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("plaid_items.id"), index=True
    )
    plaid_account_id: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    official_name: Mapped[str | None] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(50))
    subtype: Mapped[str | None] = mapped_column(String(50))
    balance_current: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    balance_available: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    iso_currency_code: Mapped[str | None] = mapped_column(String(3))

    user: Mapped["User"] = relationship(back_populates="accounts")  # noqa: F821
    plaid_item: Mapped[PlaidItem] = relationship(back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")  # noqa: F821
