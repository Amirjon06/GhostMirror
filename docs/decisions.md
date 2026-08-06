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

## Start Search With Keyword Matching

Status: accepted

The current event list endpoint supports keyword matching with SQL `LIKE` expressions and exact filters for source and event type.

SQLite FTS5 is planned as a later change when the event volume and query behavior justify an index.

## Keep Desktop Packaging Out Of The Initial Runtime

Status: accepted

Tauri packaging is planned, but the current application runs as a web app plus local API. This keeps the storage and event API stable before adding desktop distribution.
