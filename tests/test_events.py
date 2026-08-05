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


def test_get_event_by_id(client):
    created = client.post("/events", json=event_payload()).json()

    response = client.get(f"/events/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_missing_event_returns_404(client):
    response = client.get("/events/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}


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
