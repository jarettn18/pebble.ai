"""add budget_plans and budget_plan_allocations tables

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-03-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "budget_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("total_amount", sa.Numeric(precision=16, scale=2), nullable=False),
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("recurring_start_month", sa.Integer(), nullable=True),
        sa.Column("recurring_start_year", sa.Integer(), nullable=True),
        sa.Column("recurring_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_budget_plans_user_id"), "budget_plans", ["user_id"])

    op.create_table(
        "budget_plan_allocations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("budget_plan_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=16, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["budget_plan_id"], ["budget_plans.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_budget_plan_allocations_budget_plan_id"),
        "budget_plan_allocations",
        ["budget_plan_id"],
    )

    op.add_column(
        "budgets",
        sa.Column("budget_plan_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_budgets_budget_plan_id",
        "budgets",
        "budget_plans",
        ["budget_plan_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_budgets_budget_plan_id", "budgets", type_="foreignkey")
    op.drop_column("budgets", "budget_plan_id")
    op.drop_index(
        op.f("ix_budget_plan_allocations_budget_plan_id"),
        table_name="budget_plan_allocations",
    )
    op.drop_table("budget_plan_allocations")
    op.drop_index(op.f("ix_budget_plans_user_id"), table_name="budget_plans")
    op.drop_table("budget_plans")
