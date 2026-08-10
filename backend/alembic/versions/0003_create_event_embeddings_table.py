"""create event embeddings table

Revision ID: 0003_create_event_embeddings_table
Revises: 0002_create_events_fts_table
Create Date: 2026-08-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_create_event_embeddings_table"
down_revision: str | None = "0002_create_events_fts_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "event_embeddings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("dimensions", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("vector", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index(op.f("ix_event_embeddings_content_hash"), "event_embeddings", ["content_hash"], unique=False)
    op.create_index(op.f("ix_event_embeddings_created_at"), "event_embeddings", ["created_at"], unique=False)
    op.create_index(op.f("ix_event_embeddings_event_id"), "event_embeddings", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_embeddings_id"), "event_embeddings", ["id"], unique=False)
    op.create_index(op.f("ix_event_embeddings_model"), "event_embeddings", ["model"], unique=False)
    op.create_index(op.f("ix_event_embeddings_provider"), "event_embeddings", ["provider"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_embeddings_provider"), table_name="event_embeddings")
    op.drop_index(op.f("ix_event_embeddings_model"), table_name="event_embeddings")
    op.drop_index(op.f("ix_event_embeddings_id"), table_name="event_embeddings")
    op.drop_index(op.f("ix_event_embeddings_event_id"), table_name="event_embeddings")
    op.drop_index(op.f("ix_event_embeddings_created_at"), table_name="event_embeddings")
    op.drop_index(op.f("ix_event_embeddings_content_hash"), table_name="event_embeddings")
    op.drop_table("event_embeddings")
