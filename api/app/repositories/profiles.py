from typing import Optional

from sqlalchemy.orm import Session

from app.dependencies.auth import AuthenticatedUser
from app.models.profile import Profile
from app.schemas.profile import ProfileUpdate


def get_profile(db: Session, current_user: AuthenticatedUser) -> Optional[Profile]:
    return db.get(Profile, current_user.profile_id)


def ensure_profile(db: Session, current_user: AuthenticatedUser) -> Profile:
    profile = get_profile(db, current_user)
    if profile is not None:
        return profile

    profile = Profile(
        id=current_user.profile_id,
        email=current_user.email,
        display_name=current_user.email.split("@")[0],
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_profile(
    db: Session,
    current_user: AuthenticatedUser,
    payload: ProfileUpdate,
) -> Profile:
    profile = ensure_profile(db, current_user)
    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(profile, field_name, value)
    db.commit()
    db.refresh(profile)
    return profile

