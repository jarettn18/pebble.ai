"""add plaid_primary to categories and seed defaults

Revision ID: b3f1a2c4d5e6
Revises: 74e7319070ff
Create Date: 2026-03-19 12:00:00.000000

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f1a2c4d5e6'
down_revision: Union[str, None] = '74e7319070ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_CATEGORIES = [
    {"name": "Income", "plaid_primary": "INCOME", "icon": "cash", "color": "#4CAF50"},
    {"name": "Transfer In", "plaid_primary": "TRANSFER_IN", "icon": "arrow-down", "color": "#2196F3"},
    {"name": "Transfer Out", "plaid_primary": "TRANSFER_OUT", "icon": "arrow-up", "color": "#FF9800"},
    {"name": "Loan Payments", "plaid_primary": "LOAN_PAYMENTS", "icon": "bank", "color": "#795548"},
    {"name": "Bank Fees", "plaid_primary": "BANK_FEES", "icon": "alert-circle", "color": "#F44336"},
    {"name": "Entertainment", "plaid_primary": "ENTERTAINMENT", "icon": "film", "color": "#9C27B0"},
    {"name": "Food & Drink", "plaid_primary": "FOOD_AND_DRINK", "icon": "utensils", "color": "#FF5722"},
    {"name": "Shopping", "plaid_primary": "GENERAL_MERCHANDISE", "icon": "shopping-bag", "color": "#E91E63"},
    {"name": "Home Improvement", "plaid_primary": "HOME_IMPROVEMENT", "icon": "home", "color": "#607D8B"},
    {"name": "Medical", "plaid_primary": "MEDICAL", "icon": "heart-pulse", "color": "#F44336"},
    {"name": "Personal Care", "plaid_primary": "PERSONAL_CARE", "icon": "scissors", "color": "#CE93D8"},
    {"name": "Services", "plaid_primary": "GENERAL_SERVICES", "icon": "wrench", "color": "#78909C"},
    {"name": "Government", "plaid_primary": "GOVERNMENT_AND_NON_PROFIT", "icon": "landmark", "color": "#455A64"},
    {"name": "Transportation", "plaid_primary": "TRANSPORTATION", "icon": "car", "color": "#3F51B5"},
    {"name": "Travel", "plaid_primary": "TRAVEL", "icon": "plane", "color": "#00BCD4"},
    {"name": "Rent & Utilities", "plaid_primary": "RENT_AND_UTILITIES", "icon": "zap", "color": "#FF9800"},
]


def upgrade() -> None:
    # Add plaid_primary column
    op.add_column('categories', sa.Column('plaid_primary', sa.String(length=50), nullable=True))
    op.create_unique_constraint('uq_categories_plaid_primary', 'categories', ['plaid_primary'])

    # Seed default categories
    categories_table = sa.table(
        'categories',
        sa.column('id', sa.Uuid),
        sa.column('name', sa.String),
        sa.column('plaid_primary', sa.String),
        sa.column('icon', sa.String),
        sa.column('color', sa.String),
    )
    op.bulk_insert(categories_table, [
        {"id": uuid4(), **cat} for cat in DEFAULT_CATEGORIES
    ])

    # Reset all Plaid cursors so next sync re-fetches transactions with categories
    op.execute("UPDATE plaid_items SET cursor = NULL")


def downgrade() -> None:
    # Remove seeded categories (those with a plaid_primary value)
    op.execute("DELETE FROM categories WHERE plaid_primary IS NOT NULL")
    op.drop_constraint('uq_categories_plaid_primary', 'categories', type_='unique')
    op.drop_column('categories', 'plaid_primary')
