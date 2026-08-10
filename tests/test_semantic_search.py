def event_payload(**overrides):
    payload = {
        "source": "manual",
        "event_type": "note",
        "title": "Dashboard note",
        "content": "React dashboard search controls",
        "metadata": {},
    }
    payload.update(overrides)
    return payload


def test_semantic_search_returns_related_events_first(client):
    frontend_event = client.post(
        "/events",
        json=event_payload(
            source="editor",
            title="Dashboard filter panel",
            content="React TypeScript UI for filtering local activity events",
        ),
    ).json()
    client.post(
        "/events",
        json=event_payload(
            source="database",
            title="SQLite migration",
            content="Alembic migration for event persistence",
        ),
    )

    response = client.get("/events/search/semantic?q=frontend dashboard")

    assert response.status_code == 200
    results = response.json()
    assert results[0]["event"]["id"] == frontend_event["id"]
    assert 0 < results[0]["score"] <= 1


def test_semantic_search_applies_source_and_type_filters(client):
    client.post(
        "/events",
        json=event_payload(
            source="clipboard",
            event_type="snippet",
            title="Copied API route",
            content="FastAPI endpoint for search",
        ),
    )
    filesystem_event = client.post(
        "/events",
        json=event_payload(
            source="filesystem",
            event_type="file_snapshot",
            title="backend/app/api/events.py",
            content="FastAPI route handler for event search",
        ),
    ).json()

    response = client.get(
        "/events/search/semantic?q=backend endpoint&source=filesystem&event_type=file_snapshot"
    )

    assert response.status_code == 200
    assert [result["event"]["id"] for result in response.json()] == [filesystem_event["id"]]


def test_semantic_search_updates_embedding_after_event_update(client):
    created = client.post(
        "/events",
        json=event_payload(title="Frontend note", content="React dashboard control"),
    ).json()

    client.patch(
        f"/events/{created['id']}",
        json={
            "title": "Database note",
            "content": "SQLite migration for local event persistence",
        },
    )

    response = client.get("/events/search/semantic?q=database migration")

    assert response.status_code == 200
    assert response.json()[0]["event"]["id"] == created["id"]


def test_deleted_event_is_removed_from_semantic_search(client):
    created = client.post(
        "/events",
        json=event_payload(title="Search UI", content="Frontend dashboard filters"),
    ).json()

    before_delete = client.get("/events/search/semantic?q=frontend dashboard")
    delete_response = client.delete(f"/events/{created['id']}")
    after_delete = client.get("/events/search/semantic?q=frontend dashboard")

    assert before_delete.status_code == 200
    assert [result["event"]["id"] for result in before_delete.json()] == [created["id"]]
    assert delete_response.status_code == 204
    assert after_delete.status_code == 200
    assert after_delete.json() == []
