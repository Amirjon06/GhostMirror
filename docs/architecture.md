# Architecture

GhostMirror currently runs as a local web application with a FastAPI backend and SQLite database.

## Components

| Component | Path | Responsibility |
| --------- | ---- | -------------- |
| Web app | `apps/web` | React dashboard for viewing, inspecting, and managing events. |
| API routes | `backend/app/api` | FastAPI route handlers. |
| Core settings | `backend/app/core` | Application settings and environment configuration. |
| Database session | `backend/app/db` | SQLAlchemy engine, session factory, and dependency wiring. |
| Models | `backend/app/models` | SQLAlchemy table mappings. |
| Schemas | `backend/app/schemas` | Pydantic request and response models. |
| Services | `backend/app/services` | Database operations used by route handlers. |
| CLI commands | `backend/app/cli` | Local command entry points for ingestion tasks. |
| Migrations | `backend/alembic` | Database schema migrations. |
| Tests | `tests` | Backend API tests. |

## Runtime Flow

1. The React dashboard calls the FastAPI service over HTTP.
2. FastAPI validates request bodies and query parameters with Pydantic and route-level constraints.
3. Route handlers call service functions for event operations.
4. Service functions use SQLAlchemy sessions to read and write SQLite data.
5. Responses are serialized through Pydantic response schemas.

## Database

SQLite is the current database. The default database URL points to `data/ghostmirror.db`.

The `events` table stores:

- source
- event type
- title
- content
- metadata
- created timestamp
- updated timestamp

Alembic is used for migrations. The application also calls `Base.metadata.create_all` during startup so local development works against an empty database.

## Search

The current search implementation uses a SQLite FTS5 virtual table for event titles and content. Database triggers keep the FTS table in sync when events are inserted, updated, or deleted.

Source and event type filters are exact matches. If the FTS table is not available, the backend falls back to case-insensitive keyword matching with SQL `LIKE`.

## Ingestion

Clipboard ingestion runs as a local command:

```bash
cd backend
python -m app.cli.clipboard
```

The command polls the system clipboard and stores changed text values as `clipboard` source events with the `snippet` event type.

Use `--once` to capture the current clipboard value and exit.

Filesystem ingestion runs as a local command:

```bash
cd backend
python -m app.cli.filesystem /path/to/workspace --once
```

The command scans text files and stores changed file snapshots as `filesystem` source events with the `file_snapshot` event type. Hidden files and directories are skipped unless `--include-hidden` is provided.
