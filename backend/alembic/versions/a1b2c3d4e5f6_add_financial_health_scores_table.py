"""add financial_health_scores table

Revision ID: a1b2c3d4e5f6
Revises: 39928b414845
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "39928b414845"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "financial_health_scores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(length=2), nullable=False),
        sa.Column("savings_rate_score", sa.Integer(), nullable=False),
        sa.Column("debt_to_income_score", sa.Integer(), nullable=False),
        sa.Column("emergency_fund_score", sa.Integer(), nullable=False),
        sa.Column("budget_adherence_score", sa.Integer(), nullable=False),
        sa.Column("net_worth_trend_score", sa.Integer(), nullable=False),
        sa.Column("diversification_score", sa.Integer(), nullable=False),
        sa.Column("credit_score_component", sa.Integer(), nullable=True),
        sa.Column("data_completeness", sa.Numeric(precision=3, scale=2), nullable=False),
        sa.Column("component_details", sa.JSON(), nullable=False),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
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
    op.create_index(
        "ix_financial_health_scores_user_id",
        "financial_health_scores",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_financial_health_scores_user_id", table_name="financial_health_scores")
    op.drop_table("financial_health_scores")
