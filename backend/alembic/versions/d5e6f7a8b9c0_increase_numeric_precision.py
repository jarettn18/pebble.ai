"""increase numeric precision to 16,2

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-21 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ("accounts", "balance_current"),
    ("accounts", "balance_available"),
    ("transactions", "amount"),
    ("budgets", "amount"),
    ("assets", "estimated_value"),
]


def upgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(
            table, column,
            type_=sa.Numeric(16, 2),
            existing_type=sa.Numeric(12, 2) if table != "assets" else sa.Numeric(14, 2),
        )


def downgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(
            table, column,
            type_=sa.Numeric(12, 2) if table != "assets" else sa.Numeric(14, 2),
            existing_type=sa.Numeric(16, 2),
        )
