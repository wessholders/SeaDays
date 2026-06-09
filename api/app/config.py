from typing import Optional

from pydantic import AnyUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "local"
    database_url: str
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006"
    supabase_url: AnyUrl
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_issuer: str
    supabase_jwt_secret: Optional[str] = None
    r2_account_id: Optional[str] = None
    r2_access_key_id: Optional[str] = None
    r2_secret_access_key: Optional[str] = None
    r2_bucket: Optional[str] = None
    r2_public_base_url: Optional[AnyUrl] = None

    @field_validator("r2_public_base_url", mode="before")
    @classmethod
    def blank_url_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
