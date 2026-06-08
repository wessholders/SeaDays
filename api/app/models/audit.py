from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[UUID] = mapped_column(nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    changed_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    client_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

