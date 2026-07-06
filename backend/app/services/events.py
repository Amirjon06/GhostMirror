from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.schemas.event import EventCreate


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


def list_events(db: Session, limit: int = 50, offset: int = 0) -> list[Event]:
    statement = (
        select(Event)
        .order_by(Event.created_at.desc(), Event.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_event(db: Session, event_id: int) -> Event | None:
    return db.get(Event, event_id)


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.commit()
