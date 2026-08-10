# GhostMirror

GhostMirror is a local-first developer activity dashboard for capturing, storing, searching, and reviewing workflow events. It uses a FastAPI backend, SQLite persistence, and a React dashboard to make local clipboard and filesystem activity easier to inspect.

The project includes event ingestion, structured persistence, keyword search, local semantic search, import/export, activity summaries, monitor controls, automated tests, CI workflows, and a Tauri desktop app bundle for macOS.

## Features

- Store structured events with source, type, title, content, metadata, and timestamps.
- Create, list, inspect, update, delete, import, and export events.
- Search event titles and content with SQLite FTS5.
- Run local semantic search over stored event embeddings.
- Filter activity by event source and event type.
- Capture clipboard text and filesystem text snapshots.
- Review event counts, source statistics, recent activity, and event details in the dashboard.
- Run the dashboard in a browser or as a Tauri desktop app bundle.

## Architecture

GhostMirror runs as a local application with two main parts:

- `backend/app`: FastAPI service for event APIs, ingestion controls, persistence, search, and monitor state.
- `apps/web`: React and TypeScript dashboard built with Vite, Tailwind CSS, Zustand, and TanStack Query.

Runtime flow:

1. Clipboard, filesystem, or dashboard actions create events.
2. FastAPI validates requests with Pydantic schemas.
3. Service modules handle event persistence, search indexing, import/export, and monitor state.
4. SQLAlchemy stores data in SQLite.
5. SQLite FTS5 indexes event title and content for keyword search.
6. Local embeddings are stored for semantic search.
7. The React dashboard reads API data and renders activity views.

## Tech Stack

| Area | Tools |
| ---- | ----- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| State and API | Zustand, TanStack Query |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite, SQLAlchemy, Alembic |
| Search | SQLite FTS5, local event embeddings |
| Desktop | Tauri |
| Testing | pytest, Vitest, Playwright |
| DevOps | Docker Compose, GitHub Actions |

## Installation

Requirements:

- Node.js LTS and npm
- Python 3.11+
- Rust toolchain for desktop builds
- Docker optional

Clone and install dependencies:

```bash
git clone https://github.com/Amirjon06/GhostMirror.git
cd GhostMirror
./scripts/doctor.sh
./scripts/setup.sh
```

Run the API and dashboard:

```bash
./scripts/dev.sh
```

The API runs at `http://127.0.0.1:8000`.
The dashboard runs at `http://127.0.0.1:5173`.

## Usage

Start the local API only:

```bash
./scripts/api.sh
```

Start the web dashboard with clipboard monitoring:

```bash
./scripts/monitor.sh
```

Start clipboard and filesystem monitoring:

```bash
./scripts/monitor.sh /path/to/workspace
```

Create an event through the API:

```bash
curl -X POST http://127.0.0.1:8000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "manual",
    "event_type": "note",
    "title": "Debug note",
    "content": "Investigated a local API issue.",
    "metadata": {"area": "backend"}
  }'
```

Search stored events:

```bash
curl "http://127.0.0.1:8000/events?q=api&source=manual"
```

Run semantic search:

```bash
curl "http://127.0.0.1:8000/events/search/semantic?q=backend%20debugging"
```

Run the packaged desktop app with the local API:

```bash
./scripts/api.sh
open apps/web/src-tauri/target/release/bundle/macos/GhostMirror.app
```

## Desktop Release

A packaged macOS arm64 app bundle is available on the releases page:

- [GhostMirror releases](https://github.com/Amirjon06/GhostMirror/releases)
- [GhostMirror v0.2.0 macOS arm64 zip](https://github.com/Amirjon06/GhostMirror/releases/download/v0.2.0/GhostMirror_0.2.0_macos_arm64.zip)

The current desktop app connects to the local FastAPI service. Start the API with `./scripts/api.sh` before opening the app.

Build the desktop app locally:

```bash
cd apps/web
npm run desktop:build
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

More details are available in [docs/api.md](docs/api.md).

## Testing

Run the full local validation suite:

```bash
./scripts/check.sh
```

Run browser smoke tests as part of the validation suite:

```bash
RUN_E2E=1 ./scripts/check.sh
```

Run the semantic search benchmark:

```bash
./scripts/benchmark_semantic_search.py
```

## Repository Structure

```text
.github/workflows/  GitHub Actions workflows
apps/web/           React dashboard and Tauri desktop shell
backend/            FastAPI application and Alembic migrations
data/               Local SQLite data
docs/               API, architecture, roadmap, and usage documentation
scripts/            Setup, development, monitor, and validation scripts
tests/              Backend test suite
```

## Documentation

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Desktop Packaging](docs/desktop.md)
- [Decisions](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Usage](docs/usage.md)

## Limitations

- The packaged desktop app does not currently bundle the FastAPI backend as a sidecar.
- The macOS release is an app bundle zip, not a DMG installer.
- Semantic search uses a local deterministic embedding implementation, not an external model provider.

## License

No license file is currently included. Add a license before distributing or allowing reuse outside the repository owner.
