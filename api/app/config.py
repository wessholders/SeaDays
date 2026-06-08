from typing import Optional

from pydantic import AnyUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "local"
    database_url: str
    supabase_url: AnyUrl
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_issuer: str
    supabase_jwt_secret: Optional[str] = None
    r2_account_id: Optional[str] = None
    r2_access_key_id: Optional[str] = None
    r2_secret_access_key: Optional[str] = None
    r2_bucket: Optional[str] = None
    r2_public_base_url: Optional[AnyUrl] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
