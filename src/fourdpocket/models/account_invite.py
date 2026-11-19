"""A single-use registration link created by an administrator."""

from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Column, Field, SQLModel


class AccountInvite(SQLModel, table=True):
    __tablename__ = "account_invites"

    token_hash: str = Field(primary_key=True, max_length=64)
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    used_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
