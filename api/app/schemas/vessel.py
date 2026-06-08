from typing import Optional
from uuid import UUID

from pydantic import Field, field_validator

from app.domain.options import (
    OWNERSHIP_TYPES,
    PROPULSION_TYPES,
    VESSEL_IDENTIFIER_TYPES,
    normalize_option,
)
from app.schemas.common import ApiModel


class VesselIdentifierCreate(ApiModel):
    identifier_type: str
    identifier_value: str = Field(min_length=1, max_length=80)
    issuing_country: Optional[str] = "US"
    issuing_region: Optional[str] = None
    is_primary: bool = False

    @field_validator("identifier_type")
    @classmethod
    def validate_identifier_type(cls, value: str) -> str:
        return normalize_option(value, VESSEL_IDENTIFIER_TYPES, "identifier_type")


class VesselIdentifierRead(VesselIdentifierCreate):
    id: UUID


class VesselCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    display_name: Optional[str] = Field(default=None, max_length=120)
    make: Optional[str] = Field(default=None, max_length=80)
    model: Optional[str] = Field(default=None, max_length=80)
    model_year: Optional[int] = Field(default=None, ge=1800, le=2200)
    hailing_port: Optional[str] = Field(default=None, max_length=120)
    ownership_type: str = "unknown"
    owner_name: Optional[str] = Field(default=None, max_length=120)
    owner_contact: Optional[str] = Field(default=None, max_length=200)
    length_overall_inches: Optional[int] = Field(default=None, ge=0)
    beam_inches: Optional[int] = Field(default=None, ge=0)
    draft_inches: Optional[int] = Field(default=None, ge=0)
    gross_tons: Optional[float] = Field(default=None, ge=0)
    propulsion_type: str = "outboard"
    route_type: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = None
    identifiers: list[VesselIdentifierCreate] = Field(default_factory=list)

    @field_validator("ownership_type")
    @classmethod
    def validate_ownership_type(cls, value: str) -> str:
        return normalize_option(value, OWNERSHIP_TYPES, "ownership_type")

    @field_validator("propulsion_type")
    @classmethod
    def validate_propulsion_type(cls, value: str) -> str:
        return normalize_option(value, PROPULSION_TYPES, "propulsion_type")


class VesselUpdate(VesselCreate):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)


class VesselRead(VesselCreate):
    id: UUID
    created_by_profile_id: UUID
    version: int
    identifiers: list[VesselIdentifierRead] = Field(default_factory=list)

