from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError


EVENT_SEARCH_STATEMENTS = (
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS events_fts
    USING fts5(title, content, content='events', content_rowid='id')
    """,
    """
    CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
      INSERT INTO events_fts(rowid, title, content)
      VALUES (new.id, new.title, new.content);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
      INSERT INTO events_fts(events_fts, rowid, title, content)
      VALUES('delete', old.id, old.title, old.content);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
      INSERT INTO events_fts(events_fts, rowid, title, content)
      VALUES('delete', old.id, old.title, old.content);
      INSERT INTO events_fts(rowid, title, content)
      VALUES (new.id, new.title, new.content);
    END
    """,
    "INSERT INTO events_fts(events_fts) VALUES('rebuild')",
)


def create_event_search_index(engine: Engine) -> bool:
    if engine.dialect.name != "sqlite":
        return False

    try:
        with engine.begin() as connection:
            for statement in EVENT_SEARCH_STATEMENTS:
                connection.execute(text(statement))
    except SQLAlchemyError:
        return False

    return True
