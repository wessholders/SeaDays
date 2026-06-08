from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, DateTime, Text, func
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(CITEXT(), nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    legal_first_name: Mapped[Optional[str]] = mapped_column(Text)
    legal_middle_name: Mapped[Optional[str]] = mapped_column(Text)
    legal_last_name: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    address_line_1: Mapped[Optional[str]] = mapped_column(Text)
    address_line_2: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(Text)
    region: Mapped[Optional[str]] = mapped_column(Text)
    postal_code: Mapped[Optional[str]] = mapped_column(Text)
    country: Mapped[Optional[str]] = mapped_column(Text, default="US")
    mariner_reference_number: Mapped[Optional[str]] = mapped_column(Text)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

