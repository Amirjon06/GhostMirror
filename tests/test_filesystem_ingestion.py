import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.search import create_event_search_index
from app.db.session import Base
from app.services.events import list_events
from app.services.filesystem import capture_file, capture_filesystem_snapshot


@pytest.fixture
def db_session(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    create_event_search_index(engine)
    db = session_local()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_capture_file_creates_filesystem_event(tmp_path, db_session):
    root = tmp_path / "workspace"
    root.mkdir()
    file_path = root / "notes.md"
    file_path.write_text("remember alembic upgrade head", encoding="utf-8")

    result = capture_file(db_session, file_path, root=root)
    events = list_events(db_session, source="filesystem", event_type="file_snapshot")

    assert result.created is True
    assert result.reason == "created"
    assert result.event_id == events[0].id
    assert events[0].title == "notes.md"
    assert events[0].content == "remember alembic upgrade head"
    assert events[0].metadata_["path"] == str(file_path)
    assert events[0].metadata_["size_bytes"] == 29


def test_capture_file_skips_binary_content(tmp_path, db_session):
    root = tmp_path / "workspace"
    root.mkdir()
    file_path = root / "image.bin"
    file_path.write_bytes(b"\xff\xfe\x00\x00")

    result = capture_file(db_session, file_path, root=root)
    events = list_events(db_session)

    assert result.created is False
    assert result.reason == "not_text"
    assert events == []


def test_capture_filesystem_snapshot_skips_unchanged_files(tmp_path, db_session):
    root = tmp_path / "workspace"
    root.mkdir()
    file_path = root / "app.py"
    file_path.write_text("print('hello')", encoding="utf-8")

    first_results = capture_filesystem_snapshot(db_session, root)
    fingerprints = {result.path: result.fingerprint for result in first_results if result.fingerprint}
    second_results = capture_filesystem_snapshot(db_session, root, previous_fingerprints=fingerprints)
    events = list_events(db_session)

    assert [result.reason for result in first_results] == ["created"]
    assert [result.reason for result in second_results] == ["unchanged"]
    assert len(events) == 1


def test_capture_filesystem_snapshot_skips_hidden_files_by_default(tmp_path, db_session):
    root = tmp_path / "workspace"
    root.mkdir()
    hidden_path = root / ".env"
    hidden_path.write_text("SECRET=value", encoding="utf-8")

    results = capture_filesystem_snapshot(db_session, root)
    events = list_events(db_session)

    assert results == []
    assert events == []
