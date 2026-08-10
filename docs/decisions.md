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

## Store Local Event Embeddings

Status: accepted

Semantic search uses an `event_embeddings` table with provider, model, dimensions, content hash, and vector data. Event create, update, import, and delete operations keep embeddings aligned with stored events.

The default provider is deterministic and local so development, tests, and benchmarks do not require network access or API keys. The provider can be replaced later without changing the semantic search endpoint shape.

## Keep Desktop Packaging Out Of The Initial Runtime

Status: accepted

Tauri packaging is planned, but the current application runs as a web app plus local API. This keeps the storage and event API stable before adding desktop distribution.

The desktop shell should wrap the existing React dashboard instead of replacing the API and database design.

## Start Ingestion With A CLI Command

Status: accepted

Clipboard and filesystem ingestion start as backend CLI commands. This keeps capture behavior testable before adding desktop process management.
