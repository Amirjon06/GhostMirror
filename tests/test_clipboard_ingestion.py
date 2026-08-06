from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.search import create_event_search_index
from app.db.session import Base
from app.services.clipboard import capture_clipboard_text
from app.services.events import list_events


def make_session(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    create_event_search_index(engine)
    return engine, session_local()


def test_capture_clipboard_text_creates_event(tmp_path):
    engine, db = make_session(tmp_path)

    result = capture_clipboard_text(db, "select * from events;")
    events = list_events(db, source="clipboard", event_type="snippet")

    assert result.created is True
    assert result.reason == "created"
    assert result.event_id == events[0].id
    assert events[0].title == "select * from events;"
    assert events[0].content == "select * from events;"
    assert events[0].metadata_ == {"characters": 21}

    db.close()
    engine.dispose()


def test_capture_clipboard_text_skips_blank_content(tmp_path):
    engine, db = make_session(tmp_path)

    result = capture_clipboard_text(db, "   ")
    events = list_events(db)

    assert result.created is False
    assert result.reason == "empty"
    assert events == []

    db.close()
    engine.dispose()


def test_capture_clipboard_text_skips_unchanged_content(tmp_path):
    engine, db = make_session(tmp_path)

    first = capture_clipboard_text(db, "copied text")
    second = capture_clipboard_text(db, "copied text", previous_content=first.content)
    events = list_events(db)

    assert first.created is True
    assert second.created is False
    assert second.reason == "unchanged"
    assert len(events) == 1

    db.close()
    engine.dispose()
