import re
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import case, func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.event import Event, utc_now
from app.models.event_embedding import EventEmbedding
from app.schemas.event import (
    EventCreate,
    EventActivity,
    EventActivityBucket,
    EventExport,
    EventImport,
    EventImportResult,
    EventRead,
    EventSourceStats,
    EventSummary,
    EventUpdate,
)
from app.services.embeddings import (
    content_hash,
    cosine_similarity,
    event_embedding_text,
    get_embedding_provider,
)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _build_fts_query(value: str) -> str | None:
    tokens = re.findall(r"\w+", value)
    if not tokens:
        return None

    return " ".join(f'"{token}"' for token in tokens)


def _has_event_search_index(db: Session) -> bool:
    if db.bind is None or db.bind.dialect.name != "sqlite":
        return False

    result = db.execute(
        text(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'events_fts'
            """
        )
    ).scalar_one_or_none()
    return result is not None


def create_event(db: Session, event_in: EventCreate) -> Event:
    event = Event(
        source=event_in.source,
        event_type=event_in.event_type,
        title=event_in.title,
        content=event_in.content,
        metadata_=event_in.metadata,
    )
    db.add(event)
    db.flush()
    upsert_event_embedding(db, event)
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event: Event, event_in: EventUpdate) -> Event:
    values = event_in.model_dump(exclude_unset=True)

    for field in ("source", "event_type", "title", "content"):
        value = values.get(field)
        if value is not None:
            setattr(event, field, value)

    if "metadata" in values and values["metadata"] is not None:
        event.metadata_ = values["metadata"]

    upsert_event_embedding(db, event)
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
    if search_term and _has_event_search_index(db):
        fts_events = _list_events_with_fts(
            db,
            search_term=search_term,
            source=source,
            event_type=event_type,
            limit=limit,
            offset=offset,
        )
        if fts_events is not None:
            return fts_events

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


def get_event_summary(db: Session) -> EventSummary:
    total_events = db.scalar(select(func.count(Event.id))) or 0
    latest_event_created_at = db.scalar(
        select(Event.created_at).order_by(Event.created_at.desc(), Event.id.desc()).limit(1)
    )
    source_counts = {
        source: count
        for source, count in db.execute(
            select(Event.source, func.count(Event.id)).group_by(Event.source).order_by(Event.source)
        ).all()
    }
    event_type_counts = {
        event_type: count
        for event_type, count in db.execute(
            select(Event.event_type, func.count(Event.id)).group_by(Event.event_type).order_by(Event.event_type)
        ).all()
    }

    return EventSummary(
        total_events=total_events,
        source_counts=source_counts,
        event_type_counts=event_type_counts,
        latest_event_created_at=latest_event_created_at,
    )


def get_event_activity(db: Session, days: int = 7) -> EventActivity:
    end_date = utc_now().date()
    start_date = end_date - timedelta(days=days - 1)
    start_at = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    event_date = func.date(Event.created_at)
    rows = db.execute(
        select(event_date, func.count(Event.id))
        .where(Event.created_at >= start_at)
        .group_by(event_date)
    ).all()
    counts_by_date = {str(day): count for day, count in rows}
    buckets = [
        EventActivityBucket(
            date=start_date + timedelta(days=index),
            total_events=counts_by_date.get((start_date + timedelta(days=index)).isoformat(), 0),
        )
        for index in range(days)
    ]

    return EventActivity(days=days, buckets=buckets)


def list_event_sources(db: Session) -> list[EventSourceStats]:
    source_rows = db.execute(
        select(Event.source, func.count(Event.id), func.max(Event.created_at))
        .group_by(Event.source)
        .order_by(func.count(Event.id).desc(), Event.source)
    ).all()
    type_rows = db.execute(
        select(Event.source, Event.event_type, func.count(Event.id))
        .group_by(Event.source, Event.event_type)
        .order_by(Event.source, Event.event_type)
    ).all()
    type_counts_by_source: dict[str, dict[str, int]] = {}

    for source, event_type, count in type_rows:
        type_counts_by_source.setdefault(source, {})[event_type] = count

    return [
        EventSourceStats(
            source=source,
            total_events=count,
            event_type_counts=type_counts_by_source.get(source, {}),
            latest_event_created_at=latest_event_created_at,
        )
        for source, count, latest_event_created_at in source_rows
    ]


def export_events(db: Session) -> EventExport:
    events = db.scalars(select(Event).order_by(Event.created_at.desc(), Event.id.desc())).all()
    event_records = [EventRead.from_model(event) for event in events]

    return EventExport(
        exported_at=utc_now(),
        total_events=len(event_records),
        events=event_records,
    )


def import_events(db: Session, event_import: EventImport) -> EventImportResult:
    events = [
        Event(
            source=event.source,
            event_type=event.event_type,
            title=event.title,
            content=event.content,
            metadata_=event.metadata,
        )
        for event in event_import.events
    ]

    db.add_all(events)
    db.flush()
    for event in events:
        upsert_event_embedding(db, event)

    db.commit()
    return EventImportResult(imported_events=len(events))


def semantic_search_events(
    db: Session,
    q: str,
    source: str | None = None,
    event_type: str | None = None,
    limit: int = 10,
    min_score: float = 0.05,
) -> list[tuple[Event, float]]:
    ensure_event_embeddings(db)
    provider = get_embedding_provider()
    query_vector = provider.embed(q)
    statement = select(Event, EventEmbedding).join(EventEmbedding, EventEmbedding.event_id == Event.id)

    if source:
        statement = statement.where(Event.source == source.strip())

    if event_type:
        statement = statement.where(Event.event_type == event_type.strip())

    rows = db.execute(statement).all()
    ranked_events: list[tuple[Event, float]] = []

    for event, embedding in rows:
        if embedding.dimensions != provider.dimensions:
            continue

        score = max(0.0, min(1.0, cosine_similarity(query_vector, embedding.vector)))
        if score >= min_score:
            ranked_events.append((event, score))

    ranked_events.sort(key=lambda item: (item[1], item[0].created_at, item[0].id), reverse=True)
    return ranked_events[:limit]


def _list_events_with_fts(
    db: Session,
    search_term: str,
    source: str | None,
    event_type: str | None,
    limit: int,
    offset: int,
) -> list[Event] | None:
    fts_query = _build_fts_query(search_term)
    if fts_query is None:
        return None

    conditions = ["events_fts MATCH :fts_query"]
    params: dict[str, object] = {
        "fts_query": fts_query,
        "limit": limit,
        "offset": offset,
    }

    if source:
        conditions.append("events.source = :source")
        params["source"] = source.strip()

    if event_type:
        conditions.append("events.event_type = :event_type")
        params["event_type"] = event_type.strip()

    statement = text(
        f"""
        SELECT events.id
        FROM events
        JOIN events_fts ON events_fts.rowid = events.id
        WHERE {" AND ".join(conditions)}
        ORDER BY events.created_at DESC, events.id DESC
        LIMIT :limit OFFSET :offset
        """
    )

    try:
        event_ids = list(db.execute(statement, params).scalars().all())
    except SQLAlchemyError:
        db.rollback()
        return None

    if not event_ids:
        return []

    ordering = case({event_id: index for index, event_id in enumerate(event_ids)}, value=Event.id)
    events = db.scalars(select(Event).where(Event.id.in_(event_ids)).order_by(ordering)).all()
    return list(events)


def get_event(db: Session, event_id: int) -> Event | None:
    return db.get(Event, event_id)


def delete_event(db: Session, event: Event) -> None:
    embedding = db.scalar(select(EventEmbedding).where(EventEmbedding.event_id == event.id))
    if embedding is not None:
        db.delete(embedding)

    db.delete(event)
    db.commit()


def ensure_event_embeddings(db: Session) -> None:
    provider = get_embedding_provider()
    rows = db.execute(select(Event, EventEmbedding).outerjoin(EventEmbedding, EventEmbedding.event_id == Event.id)).all()
    changed = False

    for event, embedding in rows:
        text_value = event_embedding_text(event)
        if (
            embedding is None
            or embedding.content_hash != content_hash(text_value)
            or embedding.provider != provider.provider
            or embedding.model != provider.model
            or embedding.dimensions != provider.dimensions
        ):
            upsert_event_embedding(db, event)
            changed = True

    if changed:
        db.commit()


def upsert_event_embedding(db: Session, event: Event) -> EventEmbedding:
    provider = get_embedding_provider()
    text_value = event_embedding_text(event)
    hash_value = content_hash(text_value)
    embedding = db.scalar(select(EventEmbedding).where(EventEmbedding.event_id == event.id))

    if embedding is None:
        embedding = EventEmbedding(
            event_id=event.id,
            provider=provider.provider,
            model=provider.model,
            dimensions=provider.dimensions,
            content_hash=hash_value,
            vector=provider.embed(text_value),
        )
        db.add(embedding)
        return embedding

    if (
        embedding.content_hash != hash_value
        or embedding.provider != provider.provider
        or embedding.model != provider.model
        or embedding.dimensions != provider.dimensions
    ):
        embedding.provider = provider.provider
        embedding.model = provider.model
        embedding.dimensions = provider.dimensions
        embedding.content_hash = hash_value
        embedding.vector = provider.embed(text_value)

    return embedding
