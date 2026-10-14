"""roommate profiles and performance indexes

Revision ID: a1c4e7d9b203
Revises: 0f9725b5521f
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1c4e7d9b203'
down_revision: Union[str, None] = '0f9725b5521f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'roommate_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('gender', sa.String(length=10), nullable=False),
        sa.Column('same_gender_only', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('budget_min', sa.Integer(), nullable=False),
        sa.Column('budget_max', sa.Integer(), nullable=False),
        sa.Column('sleep_schedule', sa.String(length=10), nullable=False),
        sa.Column('cleanliness', sa.Integer(), nullable=False),
        sa.Column('noise_tolerance', sa.Integer(), nullable=False),
        sa.Column('guests_comfort', sa.Integer(), nullable=False),
        sa.Column('smokes', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('accepts_smoking', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('preferred_area', sa.String(length=100), nullable=True),
        sa.Column('bio', sa.String(length=280), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_roommate_profiles_gender_active', 'roommate_profiles', ['gender', 'is_active'])
    op.create_index('ix_roommate_profiles_budget', 'roommate_profiles', ['budget_min', 'budget_max'])

    op.create_index('ix_listings_status_created_at', 'listings', ['status', 'created_at'])
    op.create_index('ix_listings_owner_id', 'listings', ['owner_id'])
    op.create_index('ix_listings_listing_type', 'listings', ['listing_type'])

    op.create_index('ix_messages_listing_id', 'messages', ['listing_id'])
    op.create_index('ix_messages_receiver_read', 'messages', ['receiver_id', 'read_at'])
    op.create_index('ix_messages_sender_id', 'messages', ['sender_id'])

    op.create_index('ix_escrow_transactions_payer_id', 'escrow_transactions', ['payer_id'])
    op.create_index('ix_escrow_transactions_payee_id', 'escrow_transactions', ['payee_id'])
    op.create_index('ix_escrow_transactions_status', 'escrow_transactions', ['status'])


def downgrade() -> None:
    op.drop_index('ix_escrow_transactions_status', table_name='escrow_transactions')
    op.drop_index('ix_escrow_transactions_payee_id', table_name='escrow_transactions')
    op.drop_index('ix_escrow_transactions_payer_id', table_name='escrow_transactions')
    op.drop_index('ix_messages_sender_id', table_name='messages')
    op.drop_index('ix_messages_receiver_read', table_name='messages')
    op.drop_index('ix_messages_listing_id', table_name='messages')
    op.drop_index('ix_listings_listing_type', table_name='listings')
    op.drop_index('ix_listings_owner_id', table_name='listings')
    op.drop_index('ix_listings_status_created_at', table_name='listings')
    op.drop_index('ix_roommate_profiles_budget', table_name='roommate_profiles')
    op.drop_index('ix_roommate_profiles_gender_active', table_name='roommate_profiles')
    op.drop_table('roommate_profiles')
