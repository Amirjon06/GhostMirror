from dataclasses import dataclass, replace
from datetime import datetime
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Literal

from sqlalchemy.orm import Session, sessionmaker

from app.models.event import utc_now
from app.services.clipboard import ClipboardReader, SystemClipboardReader, capture_clipboard_text
from app.services.filesystem import FileFingerprint, capture_filesystem_snapshot

MonitorName = Literal["clipboard", "filesystem"]


class MonitorAlreadyRunning(RuntimeError):
    pass


class MonitorConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class MonitorWorkerSnapshot:
    name: MonitorName
    running: bool = False
    interval_seconds: float | None = None
    watch_path: str | None = None
    include_hidden: bool = False
    events_created: int = 0
    last_event_id: int | None = None
    last_checked_at: datetime | None = None
    last_error: str | None = None
    started_at: datetime | None = None
    stopped_at: datetime | None = None


@dataclass(frozen=True)
class MonitorStatusSnapshot:
    clipboard: MonitorWorkerSnapshot
    filesystem: MonitorWorkerSnapshot


@dataclass(frozen=True)
class WorkerRuntime:
    thread: Thread
    stop_event: Event


class MonitorManager:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        clipboard_reader: ClipboardReader | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._clipboard_reader = clipboard_reader or SystemClipboardReader()
        self._lock = Lock()
        self._states: dict[MonitorName, MonitorWorkerSnapshot] = {
            "clipboard": MonitorWorkerSnapshot(name="clipboard"),
            "filesystem": MonitorWorkerSnapshot(name="filesystem"),
        }
        self._runtimes: dict[MonitorName, WorkerRuntime] = {}

    def status(self) -> MonitorStatusSnapshot:
        with self._lock:
            return self._status_locked()

    def start_clipboard(self, interval_seconds: float = 1.0) -> MonitorStatusSnapshot:
        self._validate_interval(interval_seconds)
        stop_event = Event()
        thread = Thread(
            target=self._run_clipboard,
            args=(stop_event, interval_seconds),
            daemon=True,
            name="ghostmirror-clipboard-monitor",
        )

        with self._lock:
            if self._is_running_locked("clipboard"):
                raise MonitorAlreadyRunning("Clipboard monitor is already running.")

            self._states["clipboard"] = MonitorWorkerSnapshot(
                name="clipboard",
                running=True,
                interval_seconds=interval_seconds,
                started_at=utc_now(),
            )
            self._runtimes["clipboard"] = WorkerRuntime(thread=thread, stop_event=stop_event)
            thread.start()
            return self._status_locked()

    def stop_clipboard(self) -> MonitorStatusSnapshot:
        return self._stop_worker("clipboard")

    def start_filesystem(
        self,
        path: str,
        interval_seconds: float = 5.0,
        include_hidden: bool = False,
    ) -> MonitorStatusSnapshot:
        self._validate_interval(interval_seconds)
        root = Path(path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise MonitorConfigurationError(f"Directory does not exist: {root}")

        stop_event = Event()
        thread = Thread(
            target=self._run_filesystem,
            args=(stop_event, root, interval_seconds, include_hidden),
            daemon=True,
            name="ghostmirror-filesystem-monitor",
        )

        with self._lock:
            if self._is_running_locked("filesystem"):
                raise MonitorAlreadyRunning("Filesystem monitor is already running.")

            self._states["filesystem"] = MonitorWorkerSnapshot(
                name="filesystem",
                running=True,
                interval_seconds=interval_seconds,
                watch_path=str(root),
                include_hidden=include_hidden,
                started_at=utc_now(),
            )
            self._runtimes["filesystem"] = WorkerRuntime(thread=thread, stop_event=stop_event)
            thread.start()
            return self._status_locked()

    def stop_filesystem(self) -> MonitorStatusSnapshot:
        return self._stop_worker("filesystem")

    def stop_all(self) -> MonitorStatusSnapshot:
        self.stop_clipboard()
        self.stop_filesystem()
        return self.status()

    def _run_clipboard(self, stop_event: Event, interval_seconds: float) -> None:
        previous_content: str | None = None

        while not stop_event.is_set():
            try:
                content = self._clipboard_reader.read_text()
                with self._session_factory() as db:
                    result = capture_clipboard_text(db, content, previous_content=previous_content)

                if result.content is not None:
                    previous_content = result.content

                self._record_cycle(
                    "clipboard",
                    created=result.created,
                    event_id=result.event_id,
                    error=None,
                )
            except Exception as exc:
                self._record_cycle("clipboard", created=False, event_id=None, error=str(exc))

            stop_event.wait(interval_seconds)

        self._mark_stopped("clipboard")

    def _run_filesystem(
        self,
        stop_event: Event,
        root: Path,
        interval_seconds: float,
        include_hidden: bool,
    ) -> None:
        fingerprints: dict[Path, FileFingerprint] = {}

        while not stop_event.is_set():
            try:
                created_count = 0
                last_event_id: int | None = None
                with self._session_factory() as db:
                    results = capture_filesystem_snapshot(
                        db,
                        root,
                        previous_fingerprints=fingerprints,
                        include_hidden=include_hidden,
                    )

                for result in results:
                    if result.fingerprint is not None:
                        fingerprints[result.path] = result.fingerprint

                    if result.created:
                        created_count += 1
                        last_event_id = result.event_id

                self._record_cycle(
                    "filesystem",
                    created_count=created_count,
                    event_id=last_event_id,
                    error=None,
                )
            except Exception as exc:
                self._record_cycle("filesystem", created=False, event_id=None, error=str(exc))

            stop_event.wait(interval_seconds)

        self._mark_stopped("filesystem")

    def _record_cycle(
        self,
        name: MonitorName,
        created: bool = False,
        created_count: int = 0,
        event_id: int | None = None,
        error: str | None = None,
    ) -> None:
        increment = created_count if created_count else int(created)

        with self._lock:
            state = self._states[name]
            self._states[name] = replace(
                state,
                events_created=state.events_created + increment,
                last_event_id=event_id or state.last_event_id,
                last_checked_at=utc_now(),
                last_error=error,
            )

    def _stop_worker(self, name: MonitorName) -> MonitorStatusSnapshot:
        with self._lock:
            runtime = self._runtimes.get(name)

        if runtime is not None:
            runtime.stop_event.set()
            runtime.thread.join(timeout=2)

        with self._lock:
            if runtime is None or not runtime.thread.is_alive():
                self._runtimes.pop(name, None)
                self._states[name] = replace(
                    self._states[name],
                    running=False,
                    stopped_at=utc_now(),
                )

            return self._status_locked()

    def _mark_stopped(self, name: MonitorName) -> None:
        with self._lock:
            self._runtimes.pop(name, None)
            self._states[name] = replace(
                self._states[name],
                running=False,
                stopped_at=utc_now(),
            )

    def _status_locked(self) -> MonitorStatusSnapshot:
        for name in ("clipboard", "filesystem"):
            self._sync_running_locked(name)

        return MonitorStatusSnapshot(
            clipboard=self._states["clipboard"],
            filesystem=self._states["filesystem"],
        )

    def _sync_running_locked(self, name: MonitorName) -> None:
        runtime = self._runtimes.get(name)
        running = bool(runtime and runtime.thread.is_alive())
        state = self._states[name]

        if state.running and not running:
            self._runtimes.pop(name, None)
            self._states[name] = replace(state, running=False, stopped_at=state.stopped_at or utc_now())
        elif state.running != running:
            self._states[name] = replace(state, running=running)

    def _is_running_locked(self, name: MonitorName) -> bool:
        runtime = self._runtimes.get(name)
        return bool(runtime and runtime.thread.is_alive())

    def _validate_interval(self, interval_seconds: float) -> None:
        if interval_seconds <= 0:
            raise MonitorConfigurationError("Interval must be greater than 0.")
