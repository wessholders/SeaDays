"""add vessel owner contact fields

Revision ID: 20260616_0002
Revises: 20260606_0001
Create Date: 2026-06-16
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260616_0002"
down_revision: Union[str, None] = "20260606_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("alter table vessels add column owner_email text")
    op.execute("alter table vessels add column owner_phone text")


def downgrade() -> None:
    op.execute("alter table vessels drop column if exists owner_phone")
    op.execute("alter table vessels drop column if exists owner_email")
