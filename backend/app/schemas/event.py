from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EventBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source: str = Field(min_length=1, max_length=80)
    event_type: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, event: Any) -> "EventRead":
        return cls(
            id=event.id,
            source=event.source,
            event_type=event.event_type,
            title=event.title,
            content=event.content,
            metadata=event.metadata_,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )


class EventSummary(BaseModel):
    total_events: int
    source_counts: dict[str, int]
    event_type_counts: dict[str, int]
    latest_event_created_at: datetime | None
