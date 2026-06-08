from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import EmailStr

from app.schemas.common import ApiModel


class ProfileRead(ApiModel):
    id: UUID
    email: EmailStr
    display_name: Optional[str] = None
    legal_first_name: Optional[str] = None
    legal_middle_name: Optional[str] = None
    legal_last_name: Optional[str] = None
    phone: Optional[str] = None
    mariner_reference_number: Optional[str] = None
    date_of_birth: Optional[date] = None


class ProfileUpdate(ApiModel):
    display_name: Optional[str] = None
    legal_first_name: Optional[str] = None
    legal_middle_name: Optional[str] = None
    legal_last_name: Optional[str] = None
    phone: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "US"
    mariner_reference_number: Optional[str] = None
    date_of_birth: Optional[date] = None

