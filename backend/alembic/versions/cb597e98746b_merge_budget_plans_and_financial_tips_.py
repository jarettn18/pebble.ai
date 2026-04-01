"""merge budget_plans and financial_tips branches

Revision ID: cb597e98746b
Revises: d1e2f3a4b5c6, e6f7a8b9c0d1
Create Date: 2026-03-31 22:59:17.748637

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb597e98746b'
down_revision: Union[str, None] = ('d1e2f3a4b5c6', 'e6f7a8b9c0d1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
