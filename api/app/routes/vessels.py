from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.repositories.vessels import (
    create_vessel_for_profile,
    get_vessel_for_profile,
    list_vessels_for_profile,
    update_vessel_for_profile,
)
from app.schemas.vessel import VesselCreate, VesselRead, VesselUpdate

router = APIRouter(prefix="/vessels", tags=["vessels"])


@router.get("", response_model=list[VesselRead])
def list_vessels(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[VesselRead]:
    return list_vessels_for_profile(db, current_user.profile_id)


@router.post("", response_model=VesselRead, status_code=status.HTTP_201_CREATED)
def create_vessel(
    payload: VesselCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VesselRead:
    return create_vessel_for_profile(db, current_user.profile_id, payload)


@router.get("/{vessel_id}", response_model=VesselRead)
def get_vessel(
    vessel_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VesselRead:
    vessel = get_vessel_for_profile(db, current_user.profile_id, vessel_id)
    if vessel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vessel not found")
    return vessel


@router.patch("/{vessel_id}", response_model=VesselRead)
def update_vessel(
    vessel_id: UUID,
    payload: VesselUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VesselRead:
    vessel = update_vessel_for_profile(db, current_user.profile_id, vessel_id, payload)
    if vessel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vessel not found")
    return vessel

