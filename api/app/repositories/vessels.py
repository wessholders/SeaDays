from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.vessel import Vessel, VesselIdentifier
from app.repositories.audit import record_audit_event
from app.schemas.vessel import VesselCreate, VesselUpdate


def list_vessels_for_profile(db: Session, profile_id: UUID) -> list[Vessel]:
    statement = (
        select(Vessel)
        .where(Vessel.created_by_profile_id == profile_id, Vessel.deleted_at.is_(None))
        .order_by(Vessel.name)
    )
    return list(db.scalars(statement).all())


def get_vessel_for_profile(
    db: Session,
    profile_id: UUID,
    vessel_id: UUID,
) -> Optional[Vessel]:
    statement = select(Vessel).where(
        Vessel.id == vessel_id,
        Vessel.created_by_profile_id == profile_id,
        Vessel.deleted_at.is_(None),
    )
    return db.scalars(statement).first()


def create_vessel_for_profile(db: Session, profile_id: UUID, payload: VesselCreate) -> Vessel:
    vessel = Vessel(
        id=uuid4(),
        created_by_profile_id=profile_id,
        name=payload.name,
        display_name=payload.display_name,
        make=payload.make,
        model=payload.model,
        model_year=payload.model_year,
        hailing_port=payload.hailing_port,
        ownership_type=payload.ownership_type,
        owner_name=payload.owner_name,
        owner_contact=payload.owner_contact,
        owner_email=str(payload.owner_email) if payload.owner_email else None,
        owner_phone=payload.owner_phone,
        length_overall_inches=payload.length_overall_inches,
        beam_inches=payload.beam_inches,
        draft_inches=payload.draft_inches,
        gross_tons=payload.gross_tons,
        propulsion_type=payload.propulsion_type,
        route_type=payload.route_type,
        notes=payload.notes,
    )
    vessel.identifiers = [
        VesselIdentifier(
            id=uuid4(),
            identifier_type=identifier.identifier_type,
            identifier_value=identifier.identifier_value,
            issuing_country=identifier.issuing_country,
            issuing_region=identifier.issuing_region,
            is_primary=identifier.is_primary,
        )
        for identifier in payload.identifiers
    ]
    db.add(vessel)
    record_audit_event(
        db,
        profile_id=profile_id,
        entity_type="vessel",
        entity_id=vessel.id,
        action="create",
        changed_fields=payload.model_dump(mode="json"),
    )
    db.commit()
    db.refresh(vessel)
    return vessel


def update_vessel_for_profile(
    db: Session,
    profile_id: UUID,
    vessel_id: UUID,
    payload: VesselUpdate,
) -> Optional[Vessel]:
    vessel = get_vessel_for_profile(db, profile_id, vessel_id)
    if vessel is None:
        return None

    update_data = payload.model_dump(exclude_unset=True, exclude={"identifiers"}, mode="json")
    for field_name, value in update_data.items():
        setattr(vessel, field_name, value)
    vessel.version += 1

    if payload.identifiers:
        vessel.identifiers = [
            VesselIdentifier(
                id=uuid4(),
                identifier_type=identifier.identifier_type,
                identifier_value=identifier.identifier_value,
                issuing_country=identifier.issuing_country,
                issuing_region=identifier.issuing_region,
                is_primary=identifier.is_primary,
            )
            for identifier in payload.identifiers
        ]

    record_audit_event(
        db,
        profile_id=profile_id,
        entity_type="vessel",
        entity_id=vessel.id,
        action="update",
        changed_fields=payload.model_dump(exclude_unset=True, mode="json"),
    )
    db.commit()
    db.refresh(vessel)
    return vessel
