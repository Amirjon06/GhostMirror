def event_payload(**overrides):
    payload = {
        "source": "clipboard",
        "event_type": "snippet",
        "title": "Copied SQL query",
        "content": "select * from events;",
        "metadata": {"language": "sql"},
    }
    payload.update(overrides)
    return payload


def test_create_event(client):
    response = client.post("/events", json=event_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["source"] == "clipboard"
    assert body["event_type"] == "snippet"
    assert body["title"] == "Copied SQL query"
    assert body["content"] == "select * from events;"
    assert body["metadata"] == {"language": "sql"}
    assert body["created_at"]
    assert body["updated_at"]


def test_list_events_returns_newest_first(client):
    first = client.post("/events", json=event_payload(title="First event")).json()
    second = client.post("/events", json=event_payload(title="Second event")).json()

    response = client.get("/events")

    assert response.status_code == 200
    events = response.json()
    assert [event["id"] for event in events] == [second["id"], first["id"]]


def test_list_events_filters_by_source(client):
    client.post("/events", json=event_payload(source="clipboard", title="Clipboard event"))
    file_event = client.post(
        "/events",
        json=event_payload(source="filesystem", title="File event"),
    ).json()

    response = client.get("/events?source=filesystem")

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == [file_event["id"]]


def test_list_events_filters_by_event_type(client):
    client.post("/events", json=event_payload(event_type="snippet", title="Snippet event"))
    command_event = client.post(
        "/events",
        json=event_payload(event_type="command", title="Command event"),
    ).json()

    response = client.get("/events?event_type=command")

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == [command_event["id"]]


def test_list_events_searches_title_and_content(client):
    title_match = client.post("/events", json=event_payload(title="Copied migration plan")).json()
    content_match = client.post(
        "/events",
        json=event_payload(title="Shell note", content="remember to run alembic upgrade head"),
    ).json()
    client.post("/events", json=event_payload(title="Unrelated event", content="npm run build"))

    response = client.get("/events?q=migration")
    content_response = client.get("/events?q=ALEMBIC")

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == [title_match["id"]]
    assert content_response.status_code == 200
    assert [event["id"] for event in content_response.json()] == [content_match["id"]]


def test_list_events_combines_search_and_filters(client):
    matching_event = client.post(
        "/events",
        json=event_payload(
            source="filesystem",
            event_type="file_change",
            title="Updated FastAPI route",
        ),
    ).json()
    client.post(
        "/events",
        json=event_payload(source="clipboard", event_type="snippet", title="Updated FastAPI route"),
    )

    response = client.get("/events?q=fastapi&source=filesystem&event_type=file_change")

    assert response.status_code == 200
    assert [event["id"] for event in response.json()] == [matching_event["id"]]


def test_event_summary_returns_empty_counts(client):
    response = client.get("/events/stats/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_events": 0,
        "source_counts": {},
        "event_type_counts": {},
        "latest_event_created_at": None,
    }


def test_event_summary_counts_events_by_source_and_type(client):
    client.post("/events", json=event_payload(source="clipboard", event_type="snippet"))
    client.post(
        "/events",
        json=event_payload(source="filesystem", event_type="file_snapshot"),
    )
    latest = client.post(
        "/events",
        json=event_payload(source="filesystem", event_type="file_snapshot"),
    ).json()

    response = client.get("/events/stats/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_events": 3,
        "source_counts": {
            "clipboard": 1,
            "filesystem": 2,
        },
        "event_type_counts": {
            "file_snapshot": 2,
            "snippet": 1,
        },
        "latest_event_created_at": latest["created_at"],
    }


def test_export_events_returns_empty_export(client):
    response = client.get("/events/export")

    assert response.status_code == 200
    body = response.json()
    assert body["exported_at"]
    assert body["total_events"] == 0
    assert body["events"] == []


def test_export_events_returns_newest_first(client):
    first = client.post("/events", json=event_payload(title="First event")).json()
    second = client.post("/events", json=event_payload(title="Second event")).json()

    response = client.get("/events/export")

    assert response.status_code == 200
    body = response.json()
    assert body["total_events"] == 2
    assert [event["id"] for event in body["events"]] == [second["id"], first["id"]]
    assert body["events"][0]["title"] == "Second event"


def test_import_events_from_export_payload(client):
    export_payload = {
        "exported_at": "2026-08-07T12:00:00Z",
        "total_events": 1,
        "events": [
            {
                "id": 99,
                "source": "clipboard",
                "event_type": "snippet",
                "title": "Imported SQL query",
                "content": "select id from events;",
                "metadata": {"language": "sql"},
                "created_at": "2026-08-06T12:00:00Z",
                "updated_at": "2026-08-06T12:00:00Z",
            },
        ],
    }

    response = client.post("/events/import", json=export_payload)
    list_response = client.get("/events")

    assert response.status_code == 200
    assert response.json() == {"imported_events": 1}
    assert list_response.status_code == 200
    imported = list_response.json()[0]
    assert imported["id"] != 99
    assert imported["title"] == "Imported SQL query"
    assert imported["metadata"] == {"language": "sql"}


def test_import_events_accepts_empty_event_list(client):
    response = client.post("/events/import", json={"events": []})

    assert response.status_code == 200
    assert response.json() == {"imported_events": 0}


def test_import_events_validates_event_payload(client):
    response = client.post(
        "/events/import",
        json={"events": [event_payload(title="   ")]},
    )

    assert response.status_code == 422


def test_deleted_event_is_removed_from_search_results(client):
    created = client.post("/events", json=event_payload(title="Temporary migration note")).json()

    before_delete = client.get("/events?q=temporary")
    delete_response = client.delete(f"/events/{created['id']}")
    after_delete = client.get("/events?q=temporary")

    assert before_delete.status_code == 200
    assert [event["id"] for event in before_delete.json()] == [created["id"]]
    assert delete_response.status_code == 204
    assert after_delete.status_code == 200
    assert after_delete.json() == []


def test_get_event_by_id(client):
    created = client.post("/events", json=event_payload()).json()

    response = client.get(f"/events/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_missing_event_returns_404(client):
    response = client.get("/events/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}


def test_update_event(client):
    created = client.post("/events", json=event_payload()).json()

    response = client.patch(
        f"/events/{created['id']}",
        json={
            "title": "Updated SQL query",
            "content": "select id from events;",
            "metadata": {"language": "sql", "reviewed": True},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["source"] == "clipboard"
    assert body["event_type"] == "snippet"
    assert body["title"] == "Updated SQL query"
    assert body["content"] == "select id from events;"
    assert body["metadata"] == {"language": "sql", "reviewed": True}


def test_update_event_keeps_search_index_current(client):
    created = client.post("/events", json=event_payload(title="Draft note")).json()

    client.patch(f"/events/{created['id']}", json={"title": "Updated migration note"})

    old_search = client.get("/events?q=draft")
    new_search = client.get("/events?q=migration")

    assert old_search.status_code == 200
    assert old_search.json() == []
    assert new_search.status_code == 200
    assert [event["id"] for event in new_search.json()] == [created["id"]]


def test_update_missing_event_returns_404(client):
    response = client.patch("/events/999", json={"title": "Missing event"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}


def test_update_event_rejects_empty_payload(client):
    created = client.post("/events", json=event_payload()).json()

    response = client.patch(f"/events/{created['id']}", json={})

    assert response.status_code == 422


def test_update_event_rejects_blank_title(client):
    created = client.post("/events", json=event_payload()).json()

    response = client.patch(f"/events/{created['id']}", json={"title": "   "})

    assert response.status_code == 422


def test_delete_event(client):
    created = client.post("/events", json=event_payload()).json()

    delete_response = client.delete(f"/events/{created['id']}")
    get_response = client.get(f"/events/{created['id']}")

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


def test_delete_missing_event_returns_404(client):
    response = client.delete("/events/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}


def test_event_validation_rejects_blank_title(client):
    response = client.post("/events", json=event_payload(title="   "))

    assert response.status_code == 422


def test_list_events_validates_pagination(client):
    limit_response = client.get("/events?limit=0")
    offset_response = client.get("/events?offset=-1")

    assert limit_response.status_code == 422
    assert offset_response.status_code == 422


def test_list_events_validates_search_filters(client):
    q_response = client.get("/events?q=")
    source_response = client.get("/events?source=")
    event_type_response = client.get("/events?event_type=")

    assert q_response.status_code == 422
    assert source_response.status_code == 422
    assert event_type_response.status_code == 422
