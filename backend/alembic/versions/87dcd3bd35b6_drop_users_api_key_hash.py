"""drop users api_key_hash

Revision ID: 87dcd3bd35b6
Revises: 50180ab3445c
Create Date: 2026-04-30 13:30:50.127198

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '87dcd3bd35b6'
down_revision: Union[str, None] = '50180ab3445c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Defensively drop any legacy index on api_key_hash. The original schema
    # created the column with a UNIQUE constraint (which is implemented as
    # ``users_api_key_hash_key`` in pg), but some environments may also have
    # an ``ix_users_api_key_hash`` index — use ``if_exists`` so the migration
    # is robust to either state.
    op.drop_index('ix_users_api_key_hash', table_name='users', if_exists=True)
    # Drop the unique constraint that was created with the column. Using
    # ``if_exists`` (raw SQL) guards against environments where it was not
    # created or has already been removed.
    op.execute(
        'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_api_key_hash_key'
    )
    op.drop_column('users', 'api_key_hash')


def downgrade() -> None:
    op.add_column(
        'users',
        sa.Column('api_key_hash', sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        'users_api_key_hash_key', 'users', ['api_key_hash']
    )
