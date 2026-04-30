"""create mcp_audit_log table

Revision ID: 50180ab3445c
Revises: efd5f9d302aa
Create Date: 2026-04-30 13:30:33.375258

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '50180ab3445c'
down_revision: Union[str, None] = 'efd5f9d302aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mcp_audit_log',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('api_key_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tool_name', sa.String(length=64), nullable=False),
        sa.Column(
            'args',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['api_key_id'], ['api_keys.id'], ondelete='SET NULL'
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_mcp_audit_log_api_key_id'),
        'mcp_audit_log',
        ['api_key_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_mcp_audit_log_user_id'),
        'mcp_audit_log',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_mcp_audit_log_tool_name'),
        'mcp_audit_log',
        ['tool_name'],
        unique=False,
    )
    op.create_index(
        op.f('ix_mcp_audit_log_created_at'),
        'mcp_audit_log',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_mcp_audit_log_created_at'), table_name='mcp_audit_log')
    op.drop_index(op.f('ix_mcp_audit_log_tool_name'), table_name='mcp_audit_log')
    op.drop_index(op.f('ix_mcp_audit_log_user_id'), table_name='mcp_audit_log')
    op.drop_index(op.f('ix_mcp_audit_log_api_key_id'), table_name='mcp_audit_log')
    op.drop_table('mcp_audit_log')
