"""add chat_messages.model

Revision ID: f1a2b3c4d5e6
Revises: 87dcd3bd35b6
Create Date: 2026-05-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "87dcd3bd35b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("model", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "model")
