from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trip import Trip
from app.repositories.audit import record_audit_event
from app.repositories.vessels import get_vessel_for_profile
from app.schemas.trip import TripCreate, TripUpdate


def list_trips_for_profile(db: Session, profile_id: UUID) -> list[Trip]:
    statement = (
        select(Trip)
        .where(Trip.profile_id == profile_id, Trip.deleted_at.is_(None))
        .order_by(Trip.trip_date.desc(), Trip.started_at.desc())
    )
    return list(db.scalars(statement).all())


def get_trip_for_profile(db: Session, profile_id: UUID, trip_id: UUID) -> Optional[Trip]:
    statement = select(Trip).where(
        Trip.id == trip_id,
        Trip.profile_id == profile_id,
        Trip.deleted_at.is_(None),
    )
    return db.scalars(statement).first()


def create_trip_for_profile(db: Session, profile_id: UUID, payload: TripCreate) -> Optional[Trip]:
    if payload.vessel_id is not None and get_vessel_for_profile(db, profile_id, payload.vessel_id) is None:
        return None

    trip = Trip(id=uuid4(), profile_id=profile_id, **payload.model_dump())
    db.add(trip)
    record_audit_event(
        db,
        profile_id=profile_id,
        entity_type="trip",
        entity_id=trip.id,
        action="create",
        changed_fields=payload.model_dump(),
    )
    db.commit()
    db.refresh(trip)
    return trip


def update_trip_for_profile(
    db: Session,
    profile_id: UUID,
    trip_id: UUID,
    payload: TripUpdate,
) -> Optional[Trip]:
    trip = get_trip_for_profile(db, profile_id, trip_id)
    if trip is None:
        return None
    if payload.vessel_id is not None and get_vessel_for_profile(db, profile_id, payload.vessel_id) is None:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(trip, field_name, value)
    trip.version += 1
    record_audit_event(
        db,
        profile_id=profile_id,
        entity_type="trip",
        entity_id=trip.id,
        action="update",
        changed_fields=update_data,
    )
    db.commit()
    db.refresh(trip)
    return trip

