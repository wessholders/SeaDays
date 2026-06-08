from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import Field, field_validator

from app.domain.options import (
    PURPOSE_TYPES,
    SERVICE_ROLES,
    WATER_BODY_TYPES,
    normalize_option,
)
from app.schemas.common import ApiModel
from app.services.trip_time import normalize_time_precision


class TripCreate(ApiModel):
    vessel_id: Optional[UUID] = None
    trip_date: date
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    time_precision: str = "exact"
    service_role: str
    purpose_type: Optional[str] = None
    purpose_notes: Optional[str] = None
    location_name: Optional[str] = Field(default=None, max_length=160)
    departure_port: Optional[str] = Field(default=None, max_length=120)
    arrival_port: Optional[str] = Field(default=None, max_length=120)
    water_body_name: Optional[str] = Field(default=None, max_length=160)
    water_body_type: str = "unknown"
    distance_nm: Optional[float] = Field(default=None, ge=0)
    distance_offshore_nm: Optional[float] = Field(default=None, ge=0)
    underway_hours: Optional[float] = Field(default=None, ge=0)
    day_count: float = Field(default=0, ge=0)
    night_hours: float = Field(default=0, ge=0)
    near_coastal: bool = False
    inland: bool = False
    ocean: bool = False
    great_lakes: bool = False
    captain_name: Optional[str] = Field(default=None, max_length=120)
    self_attested: bool = True
    notes: Optional[str] = None
    status: str = "draft"

    @field_validator("time_precision")
    @classmethod
    def validate_time_precision(cls, value: str) -> str:
        return normalize_time_precision(value)

    @field_validator("service_role")
    @classmethod
    def validate_service_role(cls, value: str) -> str:
        return normalize_option(value, SERVICE_ROLES, "service_role")

    @field_validator("purpose_type")
    @classmethod
    def validate_purpose_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value.strip() == "":
            return None
        return normalize_option(value, PURPOSE_TYPES, "purpose_type")

    @field_validator("water_body_type")
    @classmethod
    def validate_water_body_type(cls, value: str) -> str:
        return normalize_option(value, WATER_BODY_TYPES, "water_body_type")


class TripUpdate(TripCreate):
    trip_date: Optional[date] = None
    service_role: Optional[str] = None


class TripRead(TripCreate):
    id: UUID
    profile_id: UUID
    version: int

