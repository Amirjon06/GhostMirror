# GhostMirror

GhostMirror is a local development activity dashboard. It stores structured events in SQLite and provides a FastAPI API with a React dashboard for viewing, creating, searching, filtering, and deleting events.

## Current Functionality

- React and TypeScript web app in `apps/web`.
- FastAPI service in `backend`.
- SQLite event storage through SQLAlchemy.
- Alembic migration for the `events` table.
- SQLite FTS5 index for event title and content search.
- Clipboard ingestion command for capturing copied text as events.
- Filesystem ingestion command for capturing text file snapshots as events.
- Demo seed command for creating local sample events.
- Event API for create, list, read, delete, keyword search, source filtering, and event type filtering.
- Dashboard UI connected to the event API, including event detail and timeline views.
- Backend pytest coverage for health, event lifecycle, validation, search, and filters.
- Frontend Vitest coverage for the event API client and dashboard rendering.
- Playwright browser smoke test for the dashboard.
- GitHub Actions workflows for backend tests and frontend validation.
- Docker Compose file for local development.

## Planned Work

- Semantic retrieval.
- Desktop packaging with Tauri.

## Architecture

- `apps/web` contains the React dashboard. It calls the FastAPI service over HTTP.
- `backend/app` contains the API routes, settings, database session, SQLAlchemy models, schemas, and services.
- `backend/alembic` contains database migrations.
- `tests` contains backend API tests.
- SQLite is the current database.

## Tech Stack

| Area | Tools |
| ---- | ----- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite, SQLAlchemy, Alembic |
| Testing | pytest |
| CI | GitHub Actions |

## Local Development

Requirements:

- Node.js LTS
- npm
- Python 3.11+

Install and run the frontend:

```bash
cd apps/web
npm install
npm run dev
```

The frontend uses `http://127.0.0.1:8000` by default. Set `VITE_API_BASE_URL` to use a different backend URL.

Install and run the backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

Run backend tests:

```bash
pytest
```

Capture clipboard events:

```bash
cd backend
python -m app.cli.clipboard
```

Capture the current clipboard value once:

```bash
cd backend
python -m app.cli.clipboard --once
```

Capture filesystem events once:

```bash
cd backend
python -m app.cli.filesystem /path/to/workspace --once
```

Create demo events:

```bash
cd backend
python -m app.cli.seed_demo
```

Run frontend checks:

```bash
cd apps/web
npm run lint
npm run test
npm run test:e2e
npm run build
```

## API

Health:

```text
GET /health
```

Events:

```text
POST /events
GET /events
GET /events/{id}
DELETE /events/{id}
```

Supported event list query parameters:

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
docs/               Project documentation
tests/              Backend tests
```

## Documentation

- [API](docs/api.md)
- [Architecture](docs/architecture.md)
- [Decisions](docs/decisions.md)
- [Roadmap](docs/roadmap.md)

## Roadmap

- [x] Application foundation
- [x] Local event persistence
- [x] Event API tests
- [x] Dashboard API integration
- [x] Backend and frontend CI
- [x] SQLite FTS5 search
- [x] Clipboard ingestion
- [x] Filesystem ingestion
- [x] Timeline and detail views
- [x] Frontend API client tests
- [x] Frontend component tests
- [x] Browser smoke test
- [x] Demo seed command
- [ ] Semantic retrieval
- [ ] Desktop packaging
