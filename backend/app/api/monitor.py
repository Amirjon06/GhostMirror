from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.session import SessionLocal
from app.schemas.monitor import ClipboardMonitorStart, FilesystemMonitorStart, MonitorStatus
from app.services.monitor import MonitorAlreadyRunning, MonitorConfigurationError, MonitorManager, MonitorStatusSnapshot

router = APIRouter(prefix="/monitors", tags=["monitors"])
monitor_manager = MonitorManager(SessionLocal)


def get_monitor_manager() -> MonitorManager:
    return monitor_manager


def to_monitor_status(snapshot: MonitorStatusSnapshot) -> MonitorStatus:
    return MonitorStatus.model_validate(asdict(snapshot))


@router.get("/status", response_model=MonitorStatus)
def get_monitor_status(
    manager: Annotated[MonitorManager, Depends(get_monitor_manager)],
) -> MonitorStatus:
    return to_monitor_status(manager.status())


@router.post("/clipboard/start", response_model=MonitorStatus)
def start_clipboard_monitor(
    request: ClipboardMonitorStart,
    manager: Annotated[MonitorManager, Depends(get_monitor_manager)],
) -> MonitorStatus:
    try:
        return to_monitor_status(manager.start_clipboard(interval_seconds=request.interval_seconds))
    except MonitorAlreadyRunning as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except MonitorConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/clipboard/stop", response_model=MonitorStatus)
def stop_clipboard_monitor(
    manager: Annotated[MonitorManager, Depends(get_monitor_manager)],
) -> MonitorStatus:
    return to_monitor_status(manager.stop_clipboard())


@router.post("/filesystem/start", response_model=MonitorStatus)
def start_filesystem_monitor(
    request: FilesystemMonitorStart,
    manager: Annotated[MonitorManager, Depends(get_monitor_manager)],
) -> MonitorStatus:
    try:
        return to_monitor_status(
            manager.start_filesystem(
                path=request.path,
                interval_seconds=request.interval_seconds,
                include_hidden=request.include_hidden,
            )
        )
    except MonitorAlreadyRunning as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except MonitorConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/filesystem/stop", response_model=MonitorStatus)
def stop_filesystem_monitor(
    manager: Annotated[MonitorManager, Depends(get_monitor_manager)],
) -> MonitorStatus:
    return to_monitor_status(manager.stop_filesystem())
