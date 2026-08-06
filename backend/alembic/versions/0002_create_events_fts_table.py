"""create events fts table

Revision ID: 0002_create_events_fts_table
Revises: 0001_create_events_table
Create Date: 2026-08-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_create_events_fts_table"
down_revision: str | None = "0001_create_events_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        op.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS events_fts
            USING fts5(title, content, content='events', content_rowid='id')
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
              INSERT INTO events_fts(rowid, title, content)
              VALUES (new.id, new.title, new.content);
            END
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
              INSERT INTO events_fts(events_fts, rowid, title, content)
              VALUES('delete', old.id, old.title, old.content);
            END
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
              INSERT INTO events_fts(events_fts, rowid, title, content)
              VALUES('delete', old.id, old.title, old.content);
              INSERT INTO events_fts(rowid, title, content)
              VALUES (new.id, new.title, new.content);
            END
            """
        )
        op.execute("INSERT INTO events_fts(events_fts) VALUES('rebuild')")
    except sa.exc.OperationalError:
        pass


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS events_au")
    op.execute("DROP TRIGGER IF EXISTS events_ad")
    op.execute("DROP TRIGGER IF EXISTS events_ai")
    op.execute("DROP TABLE IF EXISTS events_fts")
