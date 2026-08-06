from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.search import create_event_search_index
from app.db.session import Base
from app.services.demo import DEMO_SEED_ID, seed_demo_events
from app.services.events import list_events


def make_session(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    create_event_search_index(engine)
    return engine, session_local()


def test_seed_demo_events_creates_sample_events(tmp_path):
    engine, db = make_session(tmp_path)

    result = seed_demo_events(db)
    events = list_events(db, source="demo")

    assert result.created_count == 3
    assert result.skipped is False
    assert len(events) == 3
    assert {event.metadata_["seed_id"] for event in events} == {DEMO_SEED_ID}

    db.close()
    engine.dispose()


def test_seed_demo_events_is_idempotent_by_default(tmp_path):
    engine, db = make_session(tmp_path)

    first = seed_demo_events(db)
    second = seed_demo_events(db)
    events = list_events(db, source="demo")

    assert first.created_count == 3
    assert second.created_count == 0
    assert second.skipped is True
    assert len(events) == 3

    db.close()
    engine.dispose()


def test_seed_demo_events_can_force_new_events(tmp_path):
    engine, db = make_session(tmp_path)

    seed_demo_events(db)
    result = seed_demo_events(db, force=True)
    events = list_events(db, source="demo")

    assert result.created_count == 3
    assert result.skipped is False
    assert len(events) == 6

    db.close()
    engine.dispose()
