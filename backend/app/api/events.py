from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.event import (
    EventCreate,
    EventActivity,
    EventExport,
    EventImport,
    EventImportResult,
    EventRead,
    EventSemanticSearchResult,
    EventSourceStats,
    EventSummary,
    EventUpdate,
)
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


@router.get("/stats/summary", response_model=EventSummary)
def get_event_summary(db: Annotated[Session, Depends(get_db)]) -> EventSummary:
    return event_service.get_event_summary(db)


@router.get("/stats/activity", response_model=EventActivity)
def get_event_activity(
    db: Annotated[Session, Depends(get_db)],
    days: Annotated[int, Query(ge=1, le=90)] = 7,
) -> EventActivity:
    return event_service.get_event_activity(db, days=days)


@router.get("/stats/sources", response_model=list[EventSourceStats])
def list_event_sources(db: Annotated[Session, Depends(get_db)]) -> list[EventSourceStats]:
    return event_service.list_event_sources(db)


@router.get("/export", response_model=EventExport)
def export_events(db: Annotated[Session, Depends(get_db)]) -> EventExport:
    return event_service.export_events(db)


@router.post("/import", response_model=EventImportResult)
def import_events(
    event_import: EventImport,
    db: Annotated[Session, Depends(get_db)],
) -> EventImportResult:
    return event_service.import_events(db, event_import)


@router.get("/search/semantic", response_model=list[EventSemanticSearchResult])
def semantic_search_events(
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str, Query(min_length=1, max_length=200)],
    source: Annotated[str | None, Query(min_length=1, max_length=80)] = None,
    event_type: Annotated[str | None, Query(min_length=1, max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    min_score: Annotated[float, Query(ge=0, le=1)] = 0.05,
) -> list[EventSemanticSearchResult]:
    results = event_service.semantic_search_events(
        db,
        q=q,
        source=source,
        event_type=event_type,
        limit=limit,
        min_score=min_score,
    )
    return [
        EventSemanticSearchResult(event=EventRead.from_model(event), score=score)
        for event, score in results
    ]


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, db: Annotated[Session, Depends(get_db)]) -> EventRead:
    event = event_service.get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return EventRead.from_model(event)


@router.patch("/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    event_in: EventUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> EventRead:
    event = event_service.get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    updated_event = event_service.update_event(db, event, event_in)
    return EventRead.from_model(updated_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
    event = event_service.get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    event_service.delete_event(db, event)
