from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source: str = Field(min_length=1, max_length=80)
    event_type: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source: str | None = Field(default=None, min_length=1, max_length=80)
    event_type: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    metadata: dict[str, Any] | None = None

    @model_validator(mode="after")
    def require_update_field(self) -> "EventUpdate":
        if not any(
            value is not None
            for value in (self.source, self.event_type, self.title, self.content, self.metadata)
        ):
            raise ValueError("At least one field is required")

        return self


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


class EventActivityBucket(BaseModel):
    date: date
    total_events: int


class EventActivity(BaseModel):
    days: int
    buckets: list[EventActivityBucket]


class EventSourceStats(BaseModel):
    source: str
    total_events: int
    event_type_counts: dict[str, int]
    latest_event_created_at: datetime | None


class EventExport(BaseModel):
    exported_at: datetime
    total_events: int
    events: list[EventRead]


class EventImport(BaseModel):
    events: list[EventCreate] = Field(max_length=1000)


class EventImportResult(BaseModel):
    imported_events: int


class EventSemanticSearchResult(BaseModel):
    event: EventRead
    score: float = Field(ge=0, le=1)
