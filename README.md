# GhostMirror

GhostMirror is a local development activity dashboard for capturing, storing, searching, and reviewing workflow events. It runs locally, stores data in SQLite, and exposes a FastAPI service used by a React dashboard.

The project focuses on a practical event pipeline: local ingestion, structured persistence, keyword and semantic search, API access, dashboard views, tests, and CI.

## What It Does

- Stores structured events with source, type, title, content, metadata, and timestamps.
- Supports event create, list, detail, update, delete, import, and export.
- Provides keyword search over event title and content with SQLite FTS5.
- Provides local semantic search over stored event embeddings.
- Filters events by source and event type.
- Captures clipboard text as `clipboard` events.
- Captures filesystem text snapshots as `filesystem` events.
- Provides dashboard controls for starting and stopping local capture monitors.
- Shows event summaries, source counts, recent activity, and event detail views.

## How It Works

GhostMirror runs as two local services:

- The React dashboard in `apps/web`.
- The FastAPI backend in `backend/app`.

Runtime flow:

1. Local ingestion commands or dashboard actions create events.
2. FastAPI validates requests with Pydantic schemas.
3. Route handlers delegate database work to service modules.
4. SQLAlchemy persists events in SQLite.
5. SQLite FTS5 keeps title and content searchable.
6. Local event embeddings support semantic search by cosine similarity.
7. The React dashboard reads API data with TanStack Query and renders the local activity views.

## Backend Design

The backend separates HTTP routing, validation, persistence, and business logic:

- `backend/app/api` contains FastAPI route handlers.
- `backend/app/schemas` contains Pydantic request and response models.
- `backend/app/services` contains event, ingestion, and monitor logic.
- `backend/app/models` contains SQLAlchemy models.
- `backend/app/db` contains the engine, session factory, and database setup.
- `backend/alembic` contains schema migrations.

The event API supports CRUD operations, stats endpoints, import/export, keyword search, semantic search, filters, and monitor control. The application initializes the local database on startup for development use, while migrations define the durable schema.

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

Run the semantic search benchmark with a 500-event sample dataset:

```bash
./scripts/benchmark_semantic_search.py
```

Run with Docker Compose:

```bash
docker compose up --build
```

## API Surface

```text
GET    /health
POST   /events
GET    /events
GET    /events/stats/summary
GET    /events/stats/activity
GET    /events/stats/sources
GET    /events/export
POST   /events/import
GET    /events/search/semantic
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

## Validation

The project includes:

- Backend API and ingestion tests with pytest.
- Frontend unit tests with Vitest.
- Browser smoke coverage with Playwright.
- GitHub Actions workflows for backend and frontend validation.

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
- [x] Semantic retrieval
- [ ] Desktop packaging
