# GhostMirror

GhostMirror is a local development activity dashboard. It stores structured workflow events in SQLite and provides a FastAPI API with a React dashboard for viewing, searching, filtering, creating, updating, deleting, importing, and exporting events.

The current version runs as a local web application. Desktop packaging is planned.

## Current Capabilities

- Store events with source, type, title, content, metadata, and timestamps.
- Create, list, inspect, update, and delete events.
- Search event title and content with SQLite FTS5.
- Filter events by source and event type.
- Import and export events as JSON.
- Capture clipboard text as local events.
- Capture filesystem text snapshots as local events.
- Start and stop capture monitors from the dashboard.
- View summary counts, source counts, recent events, and activity history.
- Run backend tests, frontend tests, browser smoke tests, and CI checks.

## Architecture

- `apps/web` contains the React and TypeScript dashboard.
- `backend/app` contains the FastAPI application, API routes, schemas, services, settings, and database setup.
- `backend/alembic` contains SQLite migrations.
- `tests` contains backend API and ingestion tests.
- `data` contains the local SQLite database when running the app locally.

The web app calls the FastAPI service over HTTP. The backend persists events in SQLite through SQLAlchemy and keeps a SQLite FTS5 index for keyword search.

## Tech Stack

| Area | Tools |
| ---- | ----- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite, SQLAlchemy, Alembic, FTS5 |
| Testing | pytest, Vitest, Playwright |
| Tooling | Docker Compose, GitHub Actions |

## Local Development

Requirements:

- Node.js LTS
- npm
- Python 3.11+
- Docker optional
- Rust optional, required later for Tauri packaging

Set up and run:

```bash
./scripts/doctor.sh
./scripts/setup.sh
./scripts/dev.sh
```

The API runs at `http://127.0.0.1:8000`.
The web app runs at `http://127.0.0.1:5173`.

Run with clipboard monitoring:

```bash
./scripts/monitor.sh
```

Run with clipboard and filesystem monitoring:

```bash
./scripts/monitor.sh /path/to/workspace
```

Run checks:

```bash
./scripts/check.sh
RUN_E2E=1 ./scripts/check.sh
```

Run with Docker Compose:

```bash
docker compose up --build
```

## API

```text
GET    /health
POST   /events
GET    /events
GET    /events/stats/summary
GET    /events/stats/activity
GET    /events/stats/sources
GET    /events/export
POST   /events/import
GET    /events/{id}
PATCH  /events/{id}
DELETE /events/{id}
GET    /monitors/status
POST   /monitors/clipboard/start
POST   /monitors/clipboard/stop
POST   /monitors/filesystem/start
POST   /monitors/filesystem/stop
```

Event list query parameters:

```text
q
source
event_type
limit
offset
```

Example:

```bash
curl "http://127.0.0.1:8000/events?q=sql&source=clipboard&event_type=snippet"
```

## Repository Layout

```text
.github/workflows/  GitHub Actions workflows
apps/web/           React dashboard
backend/            FastAPI application and migrations
data/               Local SQLite data
docs/               Project documentation
scripts/            Local setup and development scripts
tests/              Backend tests
```

## Documentation

- [API](docs/api.md)
- [Architecture](docs/architecture.md)
- [Decisions](docs/decisions.md)
- [Desktop Packaging](docs/desktop.md)
- [Roadmap](docs/roadmap.md)
- [Usage](docs/usage.md)

## Roadmap

- [x] Application foundation
- [x] Local event persistence
- [x] Event API and dashboard
- [x] SQLite keyword search
- [x] Clipboard and filesystem ingestion
- [x] Import and export
- [x] Dashboard capture controls
- [x] Tests and CI
- [ ] Semantic retrieval
- [ ] Desktop packaging
