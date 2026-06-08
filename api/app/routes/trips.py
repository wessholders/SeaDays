from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.repositories.trips import (
    create_trip_for_profile,
    get_trip_for_profile,
    list_trips_for_profile,
    update_trip_for_profile,
)
from app.schemas.trip import TripCreate, TripRead, TripUpdate

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=list[TripRead])
def list_trips(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TripRead]:
    return list_trips_for_profile(db, current_user.profile_id)


@router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
def create_trip(
    payload: TripCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripRead:
    trip = create_trip_for_profile(db, current_user.profile_id, payload)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid vessel")
    return trip


@router.get("/{trip_id}", response_model=TripRead)
def get_trip(
    trip_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripRead:
    trip = get_trip_for_profile(db, current_user.profile_id, trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return trip


@router.patch("/{trip_id}", response_model=TripRead)
def update_trip(
    trip_id: UUID,
    payload: TripUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripRead:
    trip = update_trip_for_profile(db, current_user.profile_id, trip_id, payload)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return trip

