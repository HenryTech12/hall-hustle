"""make matric_number optional (open email signup)

Revision ID: b7e2f1a9c4d6
Revises: a1c4e7d9b203
Create Date: 2026-10-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e2f1a9c4d6'
down_revision: Union[str, None] = 'a1c4e7d9b203'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'matric_number', existing_type=sa.String(length=40), nullable=True)


def downgrade() -> None:
    # Fails if any users were created without a matric number; fill those in first.
    op.alter_column('users', 'matric_number', existing_type=sa.String(length=40), nullable=False)
