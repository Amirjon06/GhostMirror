# Decisions

This file records technical decisions that affect the project structure.

## Use SQLite First

Status: accepted

GhostMirror starts with SQLite because the application is intended to run locally and does not currently require a separate database server.

## Use SQLAlchemy and Alembic

Status: accepted

SQLAlchemy provides explicit model definitions and query construction. Alembic provides database migrations as the schema changes.

## Keep Event Operations Behind Services

Status: accepted

Route handlers validate HTTP input and map responses. Database operations live in service functions so persistence behavior can be tested and changed without growing route handlers.

## Use SQLite FTS5 For Event Search

Status: accepted

The event list endpoint uses SQLite FTS5 for keyword search over event title and content. Source and event type filters remain exact SQL filters.

The service keeps a `LIKE` fallback for databases where the FTS table is not available.

## Keep Desktop Packaging Out Of The Initial Runtime

Status: accepted

Tauri packaging is planned, but the current application runs as a web app plus local API. This keeps the storage and event API stable before adding desktop distribution.

## Start Ingestion With A CLI Command

Status: accepted

Clipboard ingestion starts as a backend CLI command. This keeps capture behavior testable before adding desktop process management.
