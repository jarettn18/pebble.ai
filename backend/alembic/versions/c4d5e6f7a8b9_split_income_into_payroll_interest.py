"""split income category into payroll, interest, dividends

Revision ID: c4d5e6f7a8b9
Revises: 6f9c43a18eb9
Create Date: 2026-03-21 18:00:00.000000

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = '6f9c43a18eb9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_CATEGORIES = [
    {"name": "Interest", "plaid_primary": None, "icon": "percent", "color": "#2196F3"},
    {"name": "Dividends", "plaid_primary": None, "icon": "trending-up", "color": "#00897B"},
]


def upgrade() -> None:
    categories_table = sa.table(
        'categories',
        sa.column('id', sa.Uuid),
        sa.column('name', sa.String),
        sa.column('plaid_primary', sa.String),
        sa.column('icon', sa.String),
        sa.column('color', sa.String),
    )

    # Rename "Income" to "Payroll"
    op.execute(
        categories_table.update()
        .where(categories_table.c.plaid_primary == 'INCOME')
        .values(name='Payroll', icon='briefcase')
    )

    # Insert new categories
    op.bulk_insert(categories_table, [
        {"id": uuid4(), **cat} for cat in NEW_CATEGORIES
    ])

    # Reset Plaid cursors so next sync re-categorizes with detailed subcategories
    op.execute("UPDATE plaid_items SET cursor = NULL")


def downgrade() -> None:
    categories_table = sa.table(
        'categories',
        sa.column('name', sa.String),
        sa.column('plaid_primary', sa.String),
        sa.column('icon', sa.String),
    )

    # Rename "Payroll" back to "Income"
    op.execute(
        categories_table.update()
        .where(categories_table.c.plaid_primary == 'INCOME')
        .values(name='Income', icon='cash')
    )

    # Remove new categories
    op.execute("DELETE FROM categories WHERE name IN ('Interest', 'Dividends')")
