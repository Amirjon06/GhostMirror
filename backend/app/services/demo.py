from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.schemas.event import EventCreate
from app.services import events as event_service

DEMO_SEED_ID = "ghostmirror-demo-v1"

DEMO_EVENTS = (
    EventCreate(
        source="demo",
        event_type="snippet",
        title="Demo clipboard snippet",
        content="const message = 'Stored locally by GhostMirror';",
        metadata={"seed_id": DEMO_SEED_ID, "example": "clipboard"},
    ),
    EventCreate(
        source="demo",
        event_type="file_snapshot",
        title="Demo filesystem snapshot",
        content="backend/app/services/events.py\nbackend/app/api/events.py\napps/web/src/App.tsx",
        metadata={"seed_id": DEMO_SEED_ID, "example": "filesystem"},
    ),
    EventCreate(
        source="demo",
        event_type="note",
        title="Demo implementation note",
        content="Use the search bar to query event titles and content through the local API.",
        metadata={"seed_id": DEMO_SEED_ID, "example": "manual"},
    ),
)


@dataclass(frozen=True)
class DemoSeedResult:
    created_count: int
    skipped: bool


def seed_demo_events(db: Session, force: bool = False) -> DemoSeedResult:
    if not force and demo_events_exist(db):
        return DemoSeedResult(created_count=0, skipped=True)

    for event in DEMO_EVENTS:
        event_service.create_event(db, event)

    return DemoSeedResult(created_count=len(DEMO_EVENTS), skipped=False)


def demo_events_exist(db: Session) -> bool:
    existing_events = event_service.list_events(db, source="demo", limit=100)
    return any(event.metadata_.get("seed_id") == DEMO_SEED_ID for event in existing_events)
