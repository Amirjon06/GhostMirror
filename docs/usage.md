# Usage

GhostMirror runs locally. The API stores events in SQLite, and the web dashboard reads from the local API.

## Start The App

Check the local environment:

```bash
./scripts/doctor.sh
```

Install dependencies:

```bash
./scripts/setup.sh
```

Start the API and dashboard:

```bash
./scripts/dev.sh
```

Open the dashboard at:

```text
http://127.0.0.1:5173
```

## Create Events

Use the Create event form in the dashboard to store a manual note, command, code snippet, or file-related event.

Required fields:

- source
- type
- title
- content

## Capture Clipboard Text

Capture the current clipboard value once:

```bash
cd backend
python -m app.cli.clipboard --once
```

Continuously capture changed clipboard text:

```bash
cd backend
python -m app.cli.clipboard
```

## Capture Filesystem Snapshots

Capture text file snapshots once:

```bash
cd backend
python -m app.cli.filesystem /path/to/workspace --once
```

Hidden files and directories are skipped unless `--include-hidden` is provided.

## Search And Filter

The dashboard search bar searches event titles and content. Source and type filters narrow the visible event list.

The backend uses SQLite FTS5 when available and falls back to case-insensitive SQL matching when the search index is unavailable.

## Edit And Delete Events

Select an event to inspect it. Use the edit button in the detail panel to update source, type, title, or content.

Use the delete button on an event row to remove it from the local database.

## Export And Import

Use Export in the dashboard to download all stored events as JSON.

Use Import to restore events from a GhostMirror export file. Imported events receive new local IDs and timestamps.

## Run Checks

Run backend tests, frontend tests, lint, and frontend build:

```bash
./scripts/check.sh
```

Include the browser smoke test:

```bash
RUN_E2E=1 ./scripts/check.sh
```

## Docker

Start the application with Docker Compose:

```bash
docker compose up --build
```
