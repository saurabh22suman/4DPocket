"""initial schema

Revision ID: 375487e8618a
Revises:
Create Date: 2026-04-02 21:57:41.630195
"""
from typing import Sequence, Union

from alembic import op
from sqlmodel import SQLModel

import fourdpocket.models  # noqa: F401 - register all models

revision: str = '375487e8618a'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create all tables defined in SQLModel metadata.
    # This ensures the migration matches what create_all() does at startup.
    bind = op.get_bind()
    # Invitations have their own explicit revision and must not be created here.
    tables = [table for table in SQLModel.metadata.sorted_tables if table.name != "account_invites"]
    SQLModel.metadata.create_all(bind, tables=tables)


def downgrade() -> None:
    # Drop all tables in reverse dependency order.
    bind = op.get_bind()
    tables = [table for table in SQLModel.metadata.sorted_tables if table.name != "account_invites"]
    SQLModel.metadata.drop_all(bind, tables=tables)
