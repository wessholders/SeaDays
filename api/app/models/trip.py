from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.id"), nullable=False)
    vessel_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("vessels.id"))
    trip_date: Mapped[date] = mapped_column(Date, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    time_precision: Mapped[str] = mapped_column(Text, nullable=False, default="exact")
    service_role: Mapped[str] = mapped_column(Text, nullable=False)
    purpose_type: Mapped[Optional[str]] = mapped_column(Text)
    purpose_notes: Mapped[Optional[str]] = mapped_column(Text)
    location_name: Mapped[Optional[str]] = mapped_column(Text)
    departure_port: Mapped[Optional[str]] = mapped_column(Text)
    arrival_port: Mapped[Optional[str]] = mapped_column(Text)
    water_body_name: Mapped[Optional[str]] = mapped_column(Text)
    water_body_type: Mapped[str] = mapped_column(Text, nullable=False, default="unknown")
    distance_nm: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    distance_offshore_nm: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    underway_hours: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    day_count: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    night_hours: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    near_coastal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    inland: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ocean: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    great_lakes: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    captain_name: Mapped[Optional[str]] = mapped_column(Text)
    self_attested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
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

