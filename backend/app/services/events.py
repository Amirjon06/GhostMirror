from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.schemas.event import EventCreate


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def create_event(db: Session, event_in: EventCreate) -> Event:
    event = Event(
        source=event_in.source,
        event_type=event_in.event_type,
        title=event_in.title,
        content=event_in.content,
        metadata_=event_in.metadata,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events(
    db: Session,
    q: str | None = None,
    source: str | None = None,
    event_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Event]:
    search_term = q.strip().lower() if q else None
    statement = select(Event)

    if source:
        statement = statement.where(Event.source == source.strip())

    if event_type:
        statement = statement.where(Event.event_type == event_type.strip())

    if search_term:
        pattern = f"%{_escape_like(search_term)}%"
        statement = statement.where(
            or_(
                func.lower(Event.title).like(pattern, escape="\\"),
                func.lower(Event.content).like(pattern, escape="\\"),
            )
        )

    statement = (
        statement.order_by(Event.created_at.desc(), Event.id.desc())
        .offset(offset)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


def get_event(db: Session, event_id: int) -> Event | None:
    return db.get(Event, event_id)


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.commit()
