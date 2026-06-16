from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Vessel(Base):
    __tablename__ = "vessels"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    created_by_profile_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    make: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(Text)
    model_year: Mapped[Optional[int]] = mapped_column(Integer)
    hailing_port: Mapped[Optional[str]] = mapped_column(Text)
    ownership_type: Mapped[str] = mapped_column(Text, nullable=False, default="unknown")
    owner_name: Mapped[Optional[str]] = mapped_column(Text)
    owner_contact: Mapped[Optional[str]] = mapped_column(Text)
    owner_email: Mapped[Optional[str]] = mapped_column(Text)
    owner_phone: Mapped[Optional[str]] = mapped_column(Text)
    length_overall_inches: Mapped[Optional[int]] = mapped_column(Integer)
    beam_inches: Mapped[Optional[int]] = mapped_column(Integer)
    draft_inches: Mapped[Optional[int]] = mapped_column(Integer)
    gross_tons: Mapped[Optional[float]] = mapped_column(Numeric(7, 2))
    propulsion_type: Mapped[str] = mapped_column(Text, nullable=False, default="outboard")
    route_type: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
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
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    identifiers: Mapped[list["VesselIdentifier"]] = relationship(
        back_populates="vessel",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class VesselIdentifier(Base):
    __tablename__ = "vessel_identifiers"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    vessel_id: Mapped[UUID] = mapped_column(
        ForeignKey("vessels.id", ondelete="CASCADE"),
        nullable=False,
    )
    identifier_type: Mapped[str] = mapped_column(Text, nullable=False)
    identifier_value: Mapped[str] = mapped_column(Text, nullable=False)
    issuing_country: Mapped[Optional[str]] = mapped_column(Text, default="US")
    issuing_region: Mapped[Optional[str]] = mapped_column(Text)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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

    vessel: Mapped[Vessel] = relationship(back_populates="identifiers")
