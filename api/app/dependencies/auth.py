from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    profile_id: UUID
    email: str


def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_profile_id: Optional[str] = Header(default=None, alias="X-Profile-Id"),
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> AuthenticatedUser:
    settings = get_settings()
    if authorization:
        return _user_from_bearer_token(authorization)

    if settings.environment == "local" and x_profile_id and x_user_email:
        return _dev_user_from_headers(x_profile_id, x_user_email)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication",
    )


def _dev_user_from_headers(x_profile_id: str, x_user_email: str) -> AuthenticatedUser:
    try:
        profile_id = UUID(x_profile_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid profile identity",
        ) from exc

    return AuthenticatedUser(profile_id=profile_id, email=x_user_email)


def _user_from_bearer_token(authorization: str) -> AuthenticatedUser:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    settings = get_settings()
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWT verification is not configured",
        )

    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.supabase_jwt_issuer,
        )
        profile_id = UUID(claims["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing email",
        )

    return AuthenticatedUser(profile_id=profile_id, email=email)
