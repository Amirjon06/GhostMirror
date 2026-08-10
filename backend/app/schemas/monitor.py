from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MonitorName = Literal["clipboard", "filesystem"]


class MonitorWorkerStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: MonitorName
    running: bool
    interval_seconds: float | None
    watch_path: str | None
    include_hidden: bool
    events_created: int
    last_event_id: int | None
    last_checked_at: datetime | None
    last_error: str | None
    started_at: datetime | None
    stopped_at: datetime | None


class MonitorStatus(BaseModel):
    clipboard: MonitorWorkerStatus
    filesystem: MonitorWorkerStatus


class ClipboardMonitorStart(BaseModel):
    interval_seconds: float = Field(default=1.0, gt=0, le=60)


class FilesystemMonitorStart(BaseModel):
    path: str = Field(min_length=1)
    interval_seconds: float = Field(default=5.0, gt=0, le=300)
    include_hidden: bool = False
