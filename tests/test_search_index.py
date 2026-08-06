from sqlalchemy import create_engine, text

import pytest

from app.db.search import create_event_search_index
from app.db.session import Base


def test_create_event_search_index_creates_fts_table(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    created = create_event_search_index(engine)

    if not created:
        pytest.skip("SQLite FTS5 is not available")

    with engine.connect() as connection:
        table_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM sqlite_master
                WHERE type = 'table' AND name = 'events_fts'
                """
            )
        ).scalar_one_or_none()

    assert table_exists == 1

    engine.dispose()
