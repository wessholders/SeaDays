from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


def record_audit_event(
    db: Session,
    profile_id: UUID,
    entity_type: str,
    entity_id: UUID,
    action: str,
    changed_fields: dict,
) -> AuditEvent:
    event = AuditEvent(
        id=uuid4(),
        profile_id=profile_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changed_fields=changed_fields,
    )
    db.add(event)
    return event

