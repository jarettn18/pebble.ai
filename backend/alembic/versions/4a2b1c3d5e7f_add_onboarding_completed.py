"""add_onboarding_completed_and_active

Revision ID: 4a2b1c3d5e7f
Revises: 39efcd9dc1dd
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a2b1c3d5e7f'
down_revision: Union[str, None] = '39efcd9dc1dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'onboarding_completed',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.create_index('ix_users_active', 'users', ['active'])


def downgrade() -> None:
    op.drop_index('ix_users_active', table_name='users')
    op.drop_column('users', 'active')
    op.drop_column('users', 'onboarding_completed')
