#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import os
import statistics
import sys
from time import perf_counter

ROOT_DIR = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT_DIR / ".venv"
VENV_PYTHON = ROOT_DIR / ".venv" / "bin" / "python"

if VENV_PYTHON.exists() and Path(sys.prefix).resolve() != VENV_DIR.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

sys.path.insert(0, str(ROOT_DIR / "backend"))

from sqlalchemy import func, select  # noqa: E402

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.models.event import Event  # noqa: E402
from app.schemas.event import EventCreate, EventImport  # noqa: E402
from app.services.events import import_events, semantic_search_events  # noqa: E402


SAMPLE_SIZE = 500
TOPICS = (
    (
        "frontend",
        "note",
        "React dashboard filter panel",
        "TypeScript UI state for dashboard search filters and local activity cards.",
    ),
    (
        "backend",
        "note",
        "FastAPI event route",
        "Route handler validates request payloads and returns structured event responses.",
    ),
    (
        "database",
        "note",
        "SQLite migration plan",
        "Alembic migration updates event tables and keeps local persistence reliable.",
    ),
    (
        "clipboard",
        "snippet",
        "Copied SQL query",
        "Clipboard ingestion captured a SQL query for later review.",
    ),
    (
        "filesystem",
        "file_snapshot",
        "backend/app/services/events.py",
        "Filesystem snapshot recorded a changed Python service file.",
    ),
)
QUERIES = (
    "frontend dashboard filters",
    "backend endpoint validation",
    "database migration table",
    "clipboard copied snippet",
    "filesystem snapshot path",
)


def build_sample_events(existing_count: int) -> list[EventCreate]:
    events: list[EventCreate] = []
    for index in range(existing_count, SAMPLE_SIZE):
        source, event_type, title, content = TOPICS[index % len(TOPICS)]
        events.append(
            EventCreate(
                source="benchmark",
                event_type=event_type,
                title=f"{title} #{index + 1}",
                content=f"{content} Sample event {index + 1}.",
                metadata={"topic": source, "benchmark_index": index + 1},
            )
        )

    return events


def percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0

    index = min(len(values) - 1, round((len(values) - 1) * ratio))
    return sorted(values)[index]


def main() -> int:
    init_db()

    with SessionLocal() as db:
        existing_count = db.scalar(select(func.count(Event.id)).where(Event.source == "benchmark")) or 0
        if existing_count < SAMPLE_SIZE:
            import_events(db, EventImport(events=build_sample_events(existing_count)))

        total_count = db.scalar(select(func.count(Event.id)).where(Event.source == "benchmark")) or 0
        timings: list[float] = []

        print(f"Benchmark events: {total_count}")
        for query in QUERIES:
            started_at = perf_counter()
            results = semantic_search_events(db, q=query, source="benchmark", limit=5)
            elapsed_ms = (perf_counter() - started_at) * 1000
            timings.append(elapsed_ms)
            top_title = results[0][0].title if results else "no result"
            print(f"{query:<30} {elapsed_ms:>8.2f} ms  top={top_title}")

        print(f"median={statistics.median(timings):.2f} ms")
        print(f"p95={percentile(timings, 0.95):.2f} ms")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
