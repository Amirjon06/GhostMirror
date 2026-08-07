# API

The backend API is implemented with FastAPI under `backend/app`.

## Health

```text
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "ghostmirror-api"
}
```

## Events

Event fields:

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | integer | response only | Database primary key. |
| `source` | string | yes | Maximum length is 80 characters. |
| `event_type` | string | yes | Maximum length is 80 characters. |
| `title` | string | yes | Maximum length is 200 characters. |
| `content` | string | yes | Event body. |
| `metadata` | object | no | Defaults to an empty object. |
| `created_at` | datetime | response only | Set by the backend. |
| `updated_at` | datetime | response only | Set by the backend. |

Blank strings are rejected for required string fields.

### Create Event

```text
POST /events
```

Request:

```json
{
  "source": "clipboard",
  "event_type": "snippet",
  "title": "Copied SQL query",
  "content": "select * from events;",
  "metadata": {
    "language": "sql"
  }
}
```

Successful response status:

```text
201 Created
```

### List Events

```text
GET /events
```

Query parameters:

| Parameter | Type | Default | Notes |
| --------- | ---- | ------- | ----- |
| `q` | string | none | Keyword match against title and content. |
| `source` | string | none | Exact source filter. |
| `event_type` | string | none | Exact event type filter. |
| `limit` | integer | 50 | Minimum 1, maximum 100. |
| `offset` | integer | 0 | Minimum 0. |

Events are returned newest first.

Search uses SQLite FTS5 when the search index is available. The backend falls back to case-insensitive `LIKE` matching when the FTS table is not present.

Example:

```bash
curl "http://127.0.0.1:8000/events?q=sql&source=clipboard&event_type=snippet"
```

### Get Event

```text
GET /events/{id}
```

Returns `404 Not Found` when the event does not exist.

### Event Summary

```text
GET /events/stats/summary
```

Response:

```json
{
  "total_events": 2,
  "source_counts": {
    "clipboard": 1,
    "filesystem": 1
  },
  "event_type_counts": {
    "file_snapshot": 1,
    "snippet": 1
  },
  "latest_event_created_at": "2026-08-06T12:05:00Z"
}
```

### Delete Event

```text
DELETE /events/{id}
```

Successful response status:

```text
204 No Content
```

Returns `404 Not Found` when the event does not exist.
