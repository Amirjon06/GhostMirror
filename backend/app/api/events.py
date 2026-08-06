from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.event import EventCreate, EventRead
from app.services import events as event_service

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(event_in: EventCreate, db: Annotated[Session, Depends(get_db)]) -> EventRead:
    event = event_service.create_event(db, event_in)
    return EventRead.from_model(event)


@router.get("", response_model=list[EventRead])
def list_events(
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    source: Annotated[str | None, Query(min_length=1, max_length=80)] = None,
    event_type: Annotated[str | None, Query(min_length=1, max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[EventRead]:
    events = event_service.list_events(
        db,
        q=q,
        source=source,
        event_type=event_type,
        limit=limit,
        offset=offset,
    )
    return [EventRead.from_model(event) for event in events]


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, db: Annotated[Session, Depends(get_db)]) -> EventRead:
    event = event_service.get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return EventRead.from_model(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
    event = event_service.get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    event_service.delete_event(db, event)
