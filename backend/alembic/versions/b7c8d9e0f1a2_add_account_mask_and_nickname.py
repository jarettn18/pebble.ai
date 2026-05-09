"""add account mask and nickname

Revision ID: b7c8d9e0f1a2
Revises: 4a2b1c3d5e7f
Create Date: 2026-04-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = '4a2b1c3d5e7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('mask', sa.String(length=8), nullable=True))
    op.add_column('accounts', sa.Column('nickname', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'nickname')
    op.drop_column('accounts', 'mask')
