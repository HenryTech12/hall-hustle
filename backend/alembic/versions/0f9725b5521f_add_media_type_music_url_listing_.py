"""add media type music url listing interests

Revision ID: 0f9725b5521f
Revises: 32fee5499d91
Create Date: 2026-07-06 11:17:47.847062

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0f9725b5521f'
down_revision: Union[str, None] = '32fee5499d91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'listing_interests',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('listing_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('listing_id', 'user_id', name='uq_listing_user_interest'),
    )
    op.add_column('listings', sa.Column('media_type', sa.String(length=10), nullable=True))
    op.add_column('listings', sa.Column('music_url', sa.String(length=500), nullable=True))
    # Backfill existing rows so media_type is never null for pre-existing listings
    op.execute("UPDATE listings SET media_type = 'image' WHERE media_type IS NULL")


def downgrade() -> None:
    op.drop_column('listings', 'music_url')
    op.drop_column('listings', 'media_type')
    op.drop_table('listing_interests')
