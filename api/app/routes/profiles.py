from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.repositories.profiles import ensure_profile, update_profile
from app.schemas.profile import ProfileRead, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileRead)
def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileRead:
    return ensure_profile(db, current_user)


@router.patch("", response_model=ProfileRead)
def patch_my_profile(
    payload: ProfileUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileRead:
    return update_profile(db, current_user, payload)

